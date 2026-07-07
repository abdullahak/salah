import ActivityKit
import Foundation

struct SalahActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var prayerName: String
        var startTime: Date
        var endTime: Date
        var locationLabel: String
        var completionState: SalahPrayerCompletionState
        var snoozeUntil: Date?
    }

    var activityId: String
}

enum SalahPrayerCompletionState: String, Codable, Hashable {
    case active
    case prayed
    case ignored

    var label: String {
        switch self {
        case .active:
            return "Active"
        case .prayed:
            return "Prayed"
        case .ignored:
            return "Ignored"
        }
    }
}
