# PinBuddy — iOS Pinterest Uploader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a SwiftUI iOS app that picks photos/short videos from the gallery, generates Russian Pinterest-optimized titles/descriptions/tags for each via Claude API, lets the user edit them, and hands media off to Pinterest via the share sheet with the caption pre-copied to the clipboard.

**Architecture:** Pure, testable Swift modules for logic (Keychain, settings, prompt building, Claude request/response, caption length rules, frame extraction, generation orchestration) sit behind protocols; thin SwiftUI views and system integrations (PhotosPicker, UIActivityViewController) consume them. The Claude client and share service are protocol-backed so they can be mocked in tests and later swapped (e.g. a real Pinterest API implementation).

**Tech Stack:** Swift 5.9+, SwiftUI, XCTest, `AVFoundation` (video frames), `Security` (Keychain), `PhotosUI` (`PhotosPicker`), `URLSession` (Claude HTTP), Anthropic Messages API. Distributed via TestFlight.

---

## Conventions

- **App/target name:** `PinBuddy` (change consistently if you rename).
- **Bundle id placeholder:** `com.example.PinBuddy` (replace with your own).
- **Default model:** `claude-haiku-4-5-20251001` (settings-overridable to a Sonnet id).
- **Test run command (adapt simulator name to an installed one):**
  ```bash
  xcodebuild test -scheme PinBuddy \
    -destination 'platform=iOS Simulator,name=iPhone 15' -quiet
  ```
  List available simulators with `xcrun simctl list devices available`.
- **TDD:** For every logic task, write the failing test first, watch it fail, implement minimally, watch it pass, commit. UI tasks are verified manually on the simulator/device (documented per task).
- **Commits:** small and frequent; message style `feat:`, `test:`, `chore:`.

## File Structure

```
PinBuddy/
  PinBuddyApp.swift                 # @main entry
  Models/
    MediaItem.swift                 # one picked photo/video + generation state
    GeneratedCaption.swift          # title/description/tags value type
    MediaType.swift                 # .photo / .video
    GenerationStatus.swift          # .idle/.generating/.done/.failed
    AppModel.swift                  # missing model ids etc. (config constants)
  Services/
    KeychainStore.swift             # store/read/delete API key
    SettingsStore.swift             # niche/language/model in UserDefaults
    PinterestPromptBuilder.swift    # builds system+user prompt from settings
    CaptionRules.swift              # length limits, truncation, tag cleanup
    ClaudeModels.swift              # Codable request/response DTOs
    ClaudeClient.swift              # protocol + URLSession implementation
    FrameExtractor.swift            # photo -> image, video -> frames, downscale
    CaptionGenerator.swift          # orchestrates extractor + client -> caption
    PinterestShareService.swift     # clipboard + UIActivityViewController
  ViewModels/
    GalleryViewModel.swift          # picked items + generation coordination
    SettingsViewModel.swift
  Views/
    RootView.swift                  # navigation shell, gates on API key
    SettingsView.swift
    GalleryView.swift               # PhotosPicker + list of cards
    CaptionCardView.swift           # preview + editable fields + publish
  Support/
    ImageDownscaler.swift           # UIImage -> compressed JPEG base64
PinBuddyTests/
  KeychainStoreTests.swift
  SettingsStoreTests.swift
  PinterestPromptBuilderTests.swift
  CaptionRulesTests.swift
  ClaudeModelsTests.swift
  ClaudeClientTests.swift
  CaptionGeneratorTests.swift
```

---

## Task 0: Project scaffolding

**Files:**
- Create: Xcode project `PinBuddy` (SwiftUI App lifecycle) with a unit-test target `PinBuddyTests`.

- [ ] **Step 1: Create the app in Xcode**

In Xcode: File → New → Project → iOS → App. Product Name `PinBuddy`, Interface **SwiftUI**, Language **Swift**, check **Include Tests**. Save into `/Users/slava/pinterest`.

- [ ] **Step 2: Add the folder groups**

Create the `Models`, `Services`, `ViewModels`, `Views`, `Support` groups listed in File Structure (empty for now).

- [ ] **Step 3: Set the Info.plist photo permission string**

Add `NSPhotoLibraryUsageDescription` = "Приложению нужен доступ к фото, чтобы выбирать медиа для публикации в Pinterest." (PhotosPicker itself needs no permission, but adding it is safe and required if we later read assets directly.)

- [ ] **Step 4: Confirm the empty test target builds**

Run: `xcodebuild test -scheme PinBuddy -destination 'platform=iOS Simulator,name=iPhone 15' -quiet`
Expected: build succeeds, 0 tests (or the template test) pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold PinBuddy SwiftUI app and test target"
```

---

## Task 1: KeychainStore

**Files:**
- Create: `PinBuddy/Services/KeychainStore.swift`
- Test: `PinBuddyTests/KeychainStoreTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import PinBuddy

final class KeychainStoreTests: XCTestCase {
    let store = KeychainStore(service: "com.example.PinBuddy.tests")

    override func tearDown() { store.deleteKey(); super.tearDown() }

    func test_saveAndRead_roundTrips() {
        store.save(key: "sk-ant-abc123")
        XCTAssertEqual(store.readKey(), "sk-ant-abc123")
    }

    func test_overwrite_replacesExistingKey() {
        store.save(key: "first")
        store.save(key: "second")
        XCTAssertEqual(store.readKey(), "second")
    }

    func test_delete_removesKey() {
        store.save(key: "x")
        store.deleteKey()
        XCTAssertNil(store.readKey())
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run the test command. Expected: FAIL — `KeychainStore` not defined.

- [ ] **Step 3: Implement minimally**

```swift
import Foundation
import Security

struct KeychainStore {
    let service: String
    private let account = "claude-api-key"

    func save(key: String) {
        deleteKey()
        let data = Data(key.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    func readKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let str = String(data: data, encoding: .utf8), !str.isEmpty
        else { return nil }
        return str
    }

    func deleteKey() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

Provide a default: `extension KeychainStore { static let shared = KeychainStore(service: "com.example.PinBuddy") }`

- [ ] **Step 4: Run tests — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add KeychainStore for Claude API key"
```

---

## Task 2: SettingsStore

**Files:**
- Create: `PinBuddy/Services/SettingsStore.swift`
- Test: `PinBuddyTests/SettingsStoreTests.swift`

Holds non-secret settings: `niche` (default "lifestyle"), `language` (default "русский"), `modelId` (default the Haiku id). Back with an injected `UserDefaults` for tests.

- [ ] **Step 1: Failing test**

```swift
import XCTest
@testable import PinBuddy

final class SettingsStoreTests: XCTestCase {
    var defaults: UserDefaults!
    var store: SettingsStore!

    override func setUp() {
        defaults = UserDefaults(suiteName: "test.\(UUID().uuidString)")
        store = SettingsStore(defaults: defaults)
    }

    func test_defaults() {
        XCTAssertEqual(store.niche, "lifestyle")
        XCTAssertEqual(store.language, "русский")
        XCTAssertEqual(store.modelId, "claude-haiku-4-5-20251001")
    }

    func test_persistsNiche() {
        store.niche = "уютный дом"
        let reloaded = SettingsStore(defaults: defaults)
        XCTAssertEqual(reloaded.niche, "уютный дом")
    }
}
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```swift
import Foundation

final class SettingsStore {
    private let defaults: UserDefaults
    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    var niche: String {
        get { defaults.string(forKey: "niche") ?? "lifestyle" }
        set { defaults.set(newValue, forKey: "niche") }
    }
    var language: String {
        get { defaults.string(forKey: "language") ?? "русский" }
        set { defaults.set(newValue, forKey: "language") }
    }
    var modelId: String {
        get { defaults.string(forKey: "modelId") ?? "claude-haiku-4-5-20251001" }
        set { defaults.set(newValue, forKey: "modelId") }
    }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat: add SettingsStore`.

---

## Task 3: Core models

**Files:**
- Create: `PinBuddy/Models/MediaType.swift`, `GenerationStatus.swift`, `GeneratedCaption.swift`, `MediaItem.swift`
- Test: covered indirectly; add `GeneratedCaptionTests` only if logic appears.

These are plain value types (no behavior yet), so no dedicated test beyond compilation.

- [ ] **Step 1: Implement the types**

```swift
// MediaType.swift
enum MediaType { case photo, video }

// GenerationStatus.swift
enum GenerationStatus: Equatable {
    case idle, generating, done, failed(String)
}

// GeneratedCaption.swift
struct GeneratedCaption: Equatable {
    var title: String
    var description: String
    var tags: [String]
}

// MediaItem.swift
import UIKit
struct MediaItem: Identifiable {
    let id = UUID()
    let type: MediaType
    var previewImage: UIImage?          // thumbnail for UI
    var analysisFrames: [UIImage]       // frames sent to Claude
    var shareURL: URL?                  // temp file to hand to Pinterest
    var status: GenerationStatus = .idle
    var caption: GeneratedCaption?      // editable after generation
}
```

- [ ] **Step 2: Build to confirm it compiles.** Run the test command; expect PASS (no new tests).
- [ ] **Step 3: Commit** `feat: add core media/caption models`.

---

## Task 4: CaptionRules (length limits & tag hygiene)

**Files:**
- Create: `PinBuddy/Services/CaptionRules.swift`
- Test: `PinBuddyTests/CaptionRulesTests.swift`

Enforces Pinterest tech limits: title ≤ 100 chars, description ≤ 500 chars, 3–8 tags, tags normalized to `#word` unique, no empties.

- [ ] **Step 1: Failing test**

```swift
import XCTest
@testable import PinBuddy

final class CaptionRulesTests: XCTestCase {
    func test_truncatesTitleTo100() {
        let long = String(repeating: "а", count: 150)
        XCTAssertEqual(CaptionRules.clampTitle(long).count, 100)
    }
    func test_truncatesDescriptionTo500() {
        let long = String(repeating: "b", count: 600)
        XCTAssertEqual(CaptionRules.clampDescription(long).count, 500)
    }
    func test_normalizeTags_dedupesAddsHashCapsAt8() {
        let input = ["#дом", "дом", "уют", "", "  стиль ", "a","b","c","d","e","f"]
        let out = CaptionRules.normalizeTags(input)
        XCTAssertTrue(out.allSatisfy { $0.hasPrefix("#") })
        XCTAssertEqual(out.count, 8)
        XCTAssertEqual(Set(out).count, out.count) // unique
    }
    func test_normalizeTags_keepsMinimumInfoWhenFew() {
        XCTAssertEqual(CaptionRules.normalizeTags(["дом"]), ["#дом"])
    }
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```swift
import Foundation

enum CaptionRules {
    static let titleMax = 100
    static let descriptionMax = 500
    static let maxTags = 8

    static func clampTitle(_ s: String) -> String { String(s.prefix(titleMax)) }
    static func clampDescription(_ s: String) -> String { String(s.prefix(descriptionMax)) }

    static func normalizeTags(_ raw: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for tag in raw {
            let trimmed = tag.trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "#", with: "")
            guard !trimmed.isEmpty else { continue }
            let normalized = "#" + trimmed
            let key = normalized.lowercased()
            if seen.insert(key).inserted {
                result.append(normalized)
                if result.count == maxTags { break }
            }
        }
        return result
    }

    static func apply(_ c: GeneratedCaption) -> GeneratedCaption {
        GeneratedCaption(title: clampTitle(c.title),
                         description: clampDescription(c.description),
                         tags: normalizeTags(c.tags))
    }
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat: add CaptionRules for Pinterest limits`.

---

## Task 5: PinterestPromptBuilder

**Files:**
- Create: `PinBuddy/Services/PinterestPromptBuilder.swift`
- Test: `PinBuddyTests/PinterestPromptBuilderTests.swift`

Builds the system prompt encoding all rules (SEO, tech limits, content policy, lifestyle style, Russian language, strict-JSON output) and a short user instruction. Kept as pure string builders so we can assert on their content.

- [ ] **Step 1: Failing test**

```swift
import XCTest
@testable import PinBuddy

final class PinterestPromptBuilderTests: XCTestCase {
    let builder = PinterestPromptBuilder(niche: "lifestyle", language: "русский")

    func test_systemPrompt_mentionsRulesAndJson() {
        let p = builder.systemPrompt()
        XCTAssertTrue(p.contains("100"))          // title limit
        XCTAssertTrue(p.contains("500"))          // description limit
        XCTAssertTrue(p.lowercased().contains("json"))
        XCTAssertTrue(p.contains("русск"))        // language
        XCTAssertTrue(p.contains("lifestyle"))    // niche
    }
    func test_userPrompt_isConcise() {
        XCTAssertFalse(builder.userPrompt().isEmpty)
    }
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** (wording can be refined later; keep the asserted tokens)

```swift
struct PinterestPromptBuilder {
    let niche: String
    let language: String

    func systemPrompt() -> String {
        """
        Ты — эксперт по контенту для Pinterest в нише «\(niche)».
        По приложенным изображениям (кадрам фото или видео) сгенерируй \
        привлекательный пин на языке: \(language).

        Требования:
        - Заголовок (title): цепляющий, с ключевым словом, не длиннее 100 символов.
        - Описание (description): естественный текст с 2–3 релевантными ключевыми \
          словами для поиска Pinterest, не длиннее 500 символов, тёплый \
          вдохновляющий тон в стиле lifestyle.
        - Теги (tags): 3–8 релевантных хэштегов без переспама.
        - Соблюдай политику Pinterest: без спама, без запрещённых/чувствительных \
          тем, без вводящих в заблуждение заявлений.

        Ответь СТРОГО валидным JSON без markdown и пояснений в формате:
        {"title": "...", "description": "...", "tags": ["#...", "#..."]}
        """
    }

    func userPrompt() -> String {
        "Проанализируй изображения и верни JSON для пина."
    }
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat: add PinterestPromptBuilder`.

---

## Task 6: Claude request/response DTOs + parsing

**Files:**
- Create: `PinBuddy/Services/ClaudeModels.swift`
- Test: `PinBuddyTests/ClaudeModelsTests.swift`

Codable structs for the Anthropic Messages API request (model, max_tokens, messages with image + text content blocks) and response, plus a helper that extracts the JSON caption from the response text (tolerating stray whitespace / code fences).

- [ ] **Step 1: Failing test**

```swift
import XCTest
@testable import PinBuddy

final class ClaudeModelsTests: XCTestCase {
    func test_parsesCaptionFromResponseText() throws {
        let json = #"{"title":"Уютное утро","description":"Тёплый свет и кофе","tags":["#уют","#дом"]}"#
        let caption = try ClaudeResponseParser.caption(fromText: json)
        XCTAssertEqual(caption.title, "Уютное утро")
        XCTAssertEqual(caption.tags, ["#уют", "#дом"])
    }
    func test_parsesEvenWithCodeFence() throws {
        let text = "```json\n{\"title\":\"t\",\"description\":\"d\",\"tags\":[\"#a\"]}\n```"
        let caption = try ClaudeResponseParser.caption(fromText: text)
        XCTAssertEqual(caption.title, "t")
    }
    func test_throwsOnGarbage() {
        XCTAssertThrowsError(try ClaudeResponseParser.caption(fromText: "no json here"))
    }
    func test_decodesApiResponseEnvelope() throws {
        let data = #"{"content":[{"type":"text","text":"hi"}]}"#.data(using: .utf8)!
        let resp = try JSONDecoder().decode(ClaudeMessageResponse.self, from: data)
        XCTAssertEqual(resp.firstText, "hi")
    }
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```swift
import Foundation

// MARK: Request
struct ClaudeRequest: Encodable {
    let model: String
    let max_tokens: Int
    let system: String
    let messages: [Message]

    struct Message: Encodable { let role: String; let content: [Block] }
    enum Block: Encodable {
        case text(String)
        case image(base64: String, mediaType: String)
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .text(let t):
                try c.encode("text", forKey: .type)
                try c.encode(t, forKey: .text)
            case .image(let b64, let mt):
                try c.encode("image", forKey: .type)
                var src = c.nestedContainer(keyedBy: SourceKeys.self, forKey: .source)
                try src.encode("base64", forKey: .type)
                try src.encode(mt, forKey: .media_type)
                try src.encode(b64, forKey: .data)
            }
        }
        enum CodingKeys: String, CodingKey { case type, text, source }
        enum SourceKeys: String, CodingKey { case type, media_type, data }
    }
}

// MARK: Response
struct ClaudeMessageResponse: Decodable {
    struct Content: Decodable { let type: String; let text: String? }
    let content: [Content]
    var firstText: String? { content.first(where: { $0.type == "text" })?.text }
}

// MARK: Parser
enum ClaudeResponseParser {
    struct ParseError: Error {}
    private struct Raw: Decodable { let title: String; let description: String; let tags: [String] }

    static func caption(fromText text: String) throws -> GeneratedCaption {
        guard let start = text.firstIndex(of: "{"),
              let end = text.lastIndex(of: "}"), start < end else { throw ParseError() }
        let slice = String(text[start...end])
        guard let data = slice.data(using: .utf8),
              let raw = try? JSONDecoder().decode(Raw.self, from: data)
        else { throw ParseError() }
        return GeneratedCaption(title: raw.title, description: raw.description, tags: raw.tags)
    }
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat: add Claude request/response models and parser`.

---

## Task 7: ClaudeClient (protocol + URLSession)

**Files:**
- Create: `PinBuddy/Services/ClaudeClient.swift`
- Test: `PinBuddyTests/ClaudeClientTests.swift` (uses a stubbed `URLProtocol`)

Protocol `ClaudeClient` with `func generate(frames:[String], system:String, user:String) async throws -> GeneratedCaption`. The `URLSessionClaudeClient` builds the request (headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type`), posts to `https://api.anthropic.com/v1/messages`, maps HTTP errors, and parses via `ClaudeResponseParser`. Frames are base64 JPEG strings.

- [ ] **Step 1: Failing test** — stub the network with a custom `URLProtocol` returning a canned Anthropic response; assert the client returns the parsed caption, and that a 401 throws `ClaudeError.unauthorized`.

```swift
import XCTest
@testable import PinBuddy

final class ClaudeClientTests: XCTestCase {
    func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: config)
    }

    func test_generate_returnsParsedCaption() async throws {
        StubURLProtocol.handler = { _ in
            let body = #"{"content":[{"type":"text","text":"{\"title\":\"T\",\"description\":\"D\",\"tags\":[\"#a\"]}"}]}"#
            return (200, Data(body.utf8))
        }
        let client = URLSessionClaudeClient(apiKey: "k", model: "m", session: makeSession())
        let caption = try await client.generate(frames: ["ZmFrZQ=="], system: "s", user: "u")
        XCTAssertEqual(caption.title, "T")
    }

    func test_generate_mapsUnauthorized() async {
        StubURLProtocol.handler = { _ in (401, Data("{}".utf8)) }
        let client = URLSessionClaudeClient(apiKey: "bad", model: "m", session: makeSession())
        do { _ = try await client.generate(frames: [], system: "s", user: "u"); XCTFail() }
        catch { XCTAssertEqual(error as? ClaudeError, .unauthorized) }
    }
}

final class StubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Int, Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for r: URLRequest) -> URLRequest { r }
    override func startLoading() {
        let (code, data) = Self.handler!(request)
        let resp = HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```swift
import Foundation

enum ClaudeError: Error, Equatable {
    case unauthorized, rateLimited, http(Int), badResponse
}

protocol ClaudeClient {
    func generate(frames: [String], system: String, user: String) async throws -> GeneratedCaption
}

struct URLSessionClaudeClient: ClaudeClient {
    let apiKey: String
    let model: String
    var session: URLSession = .shared
    var maxTokens = 600

    func generate(frames: [String], system: String, user: String) async throws -> GeneratedCaption {
        var blocks: [ClaudeRequest.Block] = frames.map { .image(base64: $0, mediaType: "image/jpeg") }
        blocks.append(.text(user))
        let body = ClaudeRequest(model: model, max_tokens: maxTokens, system: system,
                                 messages: [.init(role: "user", content: blocks)])

        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONEncoder().encode(body)

        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw ClaudeError.badResponse }
        switch http.statusCode {
        case 200: break
        case 401: throw ClaudeError.unauthorized
        case 429: throw ClaudeError.rateLimited
        default: throw ClaudeError.http(http.statusCode)
        }
        let decoded = try JSONDecoder().decode(ClaudeMessageResponse.self, from: data)
        guard let text = decoded.firstText else { throw ClaudeError.badResponse }
        return try ClaudeResponseParser.caption(fromText: text)
    }
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat: add ClaudeClient with URLSession + error mapping`.

---

## Task 8: ImageDownscaler + FrameExtractor

**Files:**
- Create: `PinBuddy/Support/ImageDownscaler.swift`, `PinBuddy/Services/FrameExtractor.swift`
- Test: `PinBuddyTests` — `ImageDownscaler` is unit-testable; `FrameExtractor` video path is verified with a bundled short test clip (or manually if none available).

`ImageDownscaler.base64JPEG(from:maxDimension:quality:)` resizes a `UIImage` so its longest side ≤ maxDimension (default 1024) and returns base64 JPEG. `FrameExtractor` turns a photo into `[downscaled]` and a video into up to 3 frames (t=0, mid, near-end) via `AVAssetImageGenerator`.

- [ ] **Step 1: Failing test for the downscaler**

```swift
import XCTest
@testable import PinBuddy

final class ImageDownscalerTests: XCTestCase {
    func test_downscalesAndEncodes() {
        let img = UIGraphicsImageRenderer(size: .init(width: 4000, height: 2000))
            .image { _ in }
        let b64 = ImageDownscaler.base64JPEG(from: img, maxDimension: 1024)
        XCTAssertFalse(b64.isEmpty)
        // longest side after decode <= 1024
        let data = Data(base64Encoded: b64)!
        let decoded = UIImage(data: data)!
        XCTAssertLessThanOrEqual(max(decoded.size.width, decoded.size.height), 1024 + 1)
    }
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```swift
// ImageDownscaler.swift
import UIKit
enum ImageDownscaler {
    static func base64JPEG(from image: UIImage, maxDimension: CGFloat = 1024, quality: CGFloat = 0.7) -> String {
        let longest = max(image.size.width, image.size.height)
        let scale = longest > maxDimension ? maxDimension / longest : 1
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let resized = UIGraphicsImageRenderer(size: size).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return (resized.jpegData(compressionQuality: quality) ?? Data()).base64EncodedString()
    }
}
```

```swift
// FrameExtractor.swift
import AVFoundation
import UIKit

enum FrameExtractor {
    static func frames(fromPhoto image: UIImage) -> [UIImage] { [image] }

    static func frames(fromVideo url: URL, maxFrames: Int = 3) async -> [UIImage] {
        let asset = AVURLAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        let duration = (try? await asset.load(.duration).seconds) ?? 0
        guard duration > 0 else { return [] }
        let stops = [0.0, duration / 2, max(0, duration - 0.2)].prefix(maxFrames)
        var out: [UIImage] = []
        for t in stops {
            let time = CMTime(seconds: t, preferredTimescale: 600)
            if let cg = try? await generator.image(at: time).image {
                out.append(UIImage(cgImage: cg))
            }
        }
        return out
    }
}
```

- [ ] **Step 4: Run — downscaler test PASS.** (Video path: verify manually in Task 12 with a real clip.)
- [ ] **Step 5: Commit** `feat: add image downscaler and video frame extractor`.

---

## Task 9: CaptionGenerator (orchestration)

**Files:**
- Create: `PinBuddy/Services/CaptionGenerator.swift`
- Test: `PinBuddyTests/CaptionGeneratorTests.swift` (stub `ClaudeClient`)

Takes frames (as base64), a `PinterestPromptBuilder`, and a `ClaudeClient`; returns a `GeneratedCaption` already passed through `CaptionRules.apply`. On client throw, rethrows a user-friendly error.

- [ ] **Step 1: Failing test**

```swift
import XCTest
@testable import PinBuddy

private struct StubClient: ClaudeClient {
    var result: Result<GeneratedCaption, Error>
    func generate(frames: [String], system: String, user: String) async throws -> GeneratedCaption {
        try result.get()
    }
}

final class CaptionGeneratorTests: XCTestCase {
    let builder = PinterestPromptBuilder(niche: "lifestyle", language: "русский")

    func test_appliesRulesToClientOutput() async throws {
        let raw = GeneratedCaption(title: String(repeating: "x", count: 200),
                                   description: "d", tags: ["дом", "#дом", "уют"])
        let gen = CaptionGenerator(client: StubClient(result: .success(raw)), promptBuilder: builder)
        let out = try await gen.generate(base64Frames: ["ZQ=="])
        XCTAssertEqual(out.title.count, 100)
        XCTAssertEqual(out.tags, ["#дом", "#уют"]) // deduped + normalized
    }

    func test_propagatesError() async {
        let gen = CaptionGenerator(client: StubClient(result: .failure(ClaudeError.rateLimited)), promptBuilder: builder)
        do { _ = try await gen.generate(base64Frames: []); XCTFail() }
        catch { XCTAssertEqual(error as? ClaudeError, .rateLimited) }
    }
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```swift
struct CaptionGenerator {
    let client: ClaudeClient
    let promptBuilder: PinterestPromptBuilder

    func generate(base64Frames: [String]) async throws -> GeneratedCaption {
        let raw = try await client.generate(
            frames: base64Frames,
            system: promptBuilder.systemPrompt(),
            user: promptBuilder.userPrompt())
        return CaptionRules.apply(raw)
    }
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat: add CaptionGenerator orchestration`.

---

## Task 10: PinterestShareService

**Files:**
- Create: `PinBuddy/Services/PinterestShareService.swift`
- Test: manual (UIKit presentation) — keep logic thin.

Copies caption text (`title` + newline + `description` + newline + tags joined by space) to `UIPasteboard`, then returns items for a share sheet: the media file URL. UI presents `UIActivityViewController`. Provide a pure `captionText(for:)` helper that IS unit-tested.

- [ ] **Step 1: Failing test for the text builder**

```swift
import XCTest
@testable import PinBuddy

final class PinterestShareServiceTests: XCTestCase {
    func test_captionText_composesTitleDescTags() {
        let c = GeneratedCaption(title: "Уют", description: "Тёплый вечер", tags: ["#дом", "#уют"])
        let text = PinterestShareService.captionText(for: c)
        XCTAssertTrue(text.contains("Уют"))
        XCTAssertTrue(text.contains("Тёплый вечер"))
        XCTAssertTrue(text.contains("#дом #уют"))
    }
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```swift
import UIKit

enum PinterestShareService {
    static func captionText(for c: GeneratedCaption) -> String {
        ([c.title, c.description, c.tags.joined(separator: " ")]
            .filter { !$0.isEmpty }).joined(separator: "\n\n")
    }

    /// Copies caption to clipboard and returns activity items (the media URL) to share.
    static func prepareShare(caption: GeneratedCaption, mediaURL: URL) -> [Any] {
        UIPasteboard.general.string = captionText(for: caption)
        return [mediaURL]
    }
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat: add PinterestShareService (clipboard + share items)`.

---

## Task 11: ViewModels

**Files:**
- Create: `PinBuddy/ViewModels/SettingsViewModel.swift`, `PinBuddy/ViewModels/GalleryViewModel.swift`

`SettingsViewModel` reads/writes `KeychainStore` + `SettingsStore`, exposes `hasKey`. `GalleryViewModel` holds `[MediaItem]`, loads picked `PhotosPickerItem`s into media (thumbnail, frames, temp share URL), and runs generation per item with status updates. Both `@MainActor @Observable`.

- [ ] **Step 1: Implement `SettingsViewModel`** (thin, mostly pass-through; add a `save(key:)` that trims whitespace and rejects empty).

- [ ] **Step 2: Implement `GalleryViewModel`** with:
  - `load(_ items: [PhotosPickerItem])` → for each: detect type, load `Data`, build preview + write a temp file for sharing, extract frames.
  - `generate(item:)` → set `.generating`, downscale frames to base64, call `CaptionGenerator`, set `.done`/`.failed`.
  - `generateAll()` → sequential loop (avoid hammering rate limits).
  - Inject a `CaptionGenerator` factory built from the current key/model so it always uses fresh settings.

- [ ] **Step 3: Build to confirm compilation.** (View models are exercised via the UI + existing service tests; optional: add a test that `generate` sets `.failed` when no key.)

- [ ] **Step 4: Commit** `feat: add Settings and Gallery view models`.

---

## Task 12: Views + wiring (manual verification)

**Files:**
- Create: `PinBuddy/Views/RootView.swift`, `SettingsView.swift`, `GalleryView.swift`, `CaptionCardView.swift`
- Modify: `PinBuddy/PinBuddyApp.swift` to show `RootView`.

- [ ] **Step 1: `RootView`** — `TabView` or nav with two destinations: Gallery and Settings. If `KeychainStore.shared.readKey()` is nil, show a banner on Gallery linking to Settings.

- [ ] **Step 2: `SettingsView`** — `SecureField` for the API key (masked), niche `TextField`, model `Picker` (Haiku default / a Sonnet id), Save button → `SettingsViewModel.save`.

- [ ] **Step 3: `GalleryView`** — `PhotosPicker(selection:matching:.any(of: [.images, .videos]))`, a "Сгенерировать все" button, and a `List`/`ScrollView` of `CaptionCardView`.

- [ ] **Step 4: `CaptionCardView`** — thumbnail, status indicator, editable `TextField` (title), `TextEditor` (description), tags field, per-card "Сгенерировать"/"Повторить", and "Опубликовать" → presents `UIActivityViewController` from `PinterestShareService.prepareShare(...)` (wrap in a `UIViewControllerRepresentable` share-sheet helper). Show live character counters against `CaptionRules.titleMax`/`descriptionMax`.

- [ ] **Step 5: Manual end-to-end verification on the simulator/device**

  1. Launch → Settings → paste a real Claude key → Save.
  2. Gallery → pick 1 photo + 1 short video.
  3. Confirm thumbnails + share temp files created; run "Сгенерировать все".
  4. Confirm Russian title/description/tags appear, within limits; edit one field.
  5. Tap "Опубликовать" → share sheet opens, choose Pinterest → confirm media is attached and caption is on the clipboard (paste into description).
  6. Error cases: wrong key → clear message; airplane mode → retry works.

- [ ] **Step 6: Commit** `feat: add SwiftUI views and wire end-to-end flow`.

---

## Task 13: TestFlight distribution checklist (manual, outside code)

- [ ] Enroll in the Apple Developer Program ($99/year) if not already.
- [ ] Set a unique bundle id + a real signing team in Xcode → Signing & Capabilities.
- [ ] Create the app record in App Store Connect.
- [ ] Archive (Product → Archive) → upload to App Store Connect.
- [ ] Add the girlfriend's Apple ID as an internal/external TestFlight tester; send invite.
- [ ] On her device: install TestFlight → accept invite → install PinBuddy → you enter your Claude API key once in Settings.

---

## Notes / Deferred (from spec §10)

- Automatic upload via Pinterest API v5 is deferred; `PinterestShareService` is a value-type seam that a future `PinterestApiService` (behind a shared protocol) can replace.
- Verify on-device whether Pinterest's share extension accepts video identically to photos; if not, branch the share handling for video.
- Confirm current Anthropic model id/pricing before shipping; keep the model id in `SettingsStore` so it is trivially updatable.
