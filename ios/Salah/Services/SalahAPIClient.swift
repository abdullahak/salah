import Foundation

struct SalahAPIClient {
    static let shared = SalahAPIClient()

    private let baseURL = URL(string: "https://api.salah.abdlh.com")!
    private let deviceIdKey = "salah:api-device-id:v1"
    private let defaults: UserDefaults
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(
        defaults: UserDefaults = .standard,
        session: URLSession = .shared,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.defaults = defaults
        self.session = session
        self.encoder = encoder
        self.decoder = decoder
    }

    func register(state: SalahAppState) async throws {
        var requestBody = DeviceRegistrationRequest(
            location: LocationPayload(state.location),
            timezone: state.location.timezone,
            settings: SettingsPayload(state.settings),
            tokenEnvironment: tokenEnvironment
        )
        requestBody.deviceId = defaults.string(forKey: deviceIdKey)

        let response: DeviceResponseEnvelope = try await send(
            path: "/v1/devices/register",
            method: "POST",
            body: requestBody
        )
        defaults.set(response.device.id, forKey: deviceIdKey)
    }

    func updateSettings(state: SalahAppState) async throws {
        guard let deviceId = defaults.string(forKey: deviceIdKey) else {
            try await register(state: state)
            return
        }

        let requestBody = DeviceSettingsRequest(
            location: LocationPayload(state.location),
            timezone: state.location.timezone,
            settings: SettingsPayload(state.settings)
        )

        let _: DeviceResponseEnvelope = try await send(
            path: "/v1/devices/\(deviceId)/settings",
            method: "PUT",
            body: requestBody
        )
    }

    func updateActivityToken(pushToStartToken: String? = nil, updateToken: String? = nil) async throws {
        guard pushToStartToken != nil || updateToken != nil else {
            return
        }

        guard let deviceId = defaults.string(forKey: deviceIdKey) else {
            return
        }

        let requestBody = ActivityTokenRequest(
            pushToStartToken: pushToStartToken,
            updateToken: updateToken,
            tokenEnvironment: tokenEnvironment
        )

        let _: DeviceResponseEnvelope = try await send(
            path: "/v1/devices/\(deviceId)/activity-token",
            method: "POST",
            body: requestBody
        )
    }

    private var tokenEnvironment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    private func send<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        method: String,
        body: RequestBody
    ) async throws -> ResponseBody {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw SalahAPIClientError.requestFailed
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw SalahAPIClientError.requestFailed
        }

        return try decoder.decode(ResponseBody.self, from: data)
    }
}

enum SalahAPIClientError: Error {
    case requestFailed
}

private struct DeviceRegistrationRequest: Encodable {
    var deviceId: String?
    var location: LocationPayload
    var timezone: String
    var settings: SettingsPayload
    var tokenEnvironment: String
}

private struct DeviceSettingsRequest: Encodable {
    var location: LocationPayload
    var timezone: String
    var settings: SettingsPayload
}

private struct ActivityTokenRequest: Encodable {
    var pushToStartToken: String?
    var updateToken: String?
    var tokenEnvironment: String
}

private struct LocationPayload: Encodable {
    var label: String
    var latitude: Double
    var longitude: Double

    init(_ location: ResolvedLocation) {
        label = location.label
        latitude = location.latitude
        longitude = location.longitude
    }
}

private struct SettingsPayload: Encodable {
    var calculationMethod: String
    var madhab: String
    var timeFormat: String
    var snoozeDurationMinutes: Int

    init(_ settings: PrayerSettings) {
        calculationMethod = settings.calculationMethod.rawValue
        madhab = settings.madhab.rawValue
        timeFormat = settings.timeFormat.rawValue
        snoozeDurationMinutes = settings.snoozeDurationMinutes
    }
}

private struct DeviceResponseEnvelope: Decodable {
    var device: DeviceResponse
}

private struct DeviceResponse: Decodable {
    var id: String
}

extension Data {
    var hexEncodedString: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
