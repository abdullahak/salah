import Foundation

enum SalahWidgetAPIClient {
    private static let baseURL = URL(string: "https://api.salah.abdlh.com")!

    static func markPrayed(activityId: String) async {
        await postAction("prayed", activityId: activityId)
    }

    static func snooze(activityId: String) async {
        await postAction("snooze", activityId: activityId)
    }

    static func ignore(activityId: String) async {
        await postAction("ignore", activityId: activityId)
    }

    private static func postAction(_ action: String, activityId: String) async {
        guard let encodedActivityId = activityId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            return
        }

        guard let url = URL(string: "/v1/prayers/\(encodedActivityId)/\(action)", relativeTo: baseURL)?.absoluteURL else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)

        _ = try? await URLSession.shared.data(for: request)
    }
}
