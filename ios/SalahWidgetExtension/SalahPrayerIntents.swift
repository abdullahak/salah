import ActivityKit
import AppIntents
import Foundation

struct PrayedPrayerIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Prayed"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity ID")
    var activityId: String

    init() {
        activityId = ""
    }

    init(activityId: String) {
        self.activityId = activityId
    }

    func perform() async throws -> some IntentResult {
        await SalahWidgetAPIClient.markPrayed(activityId: activityId)
        await SalahActivityIntentActions.end(
            activityId: activityId,
            completionState: .prayed,
            messageSnoozeUntil: nil
        )
        return .result()
    }
}

struct SnoozePrayerIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Snooze"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity ID")
    var activityId: String

    init() {
        activityId = ""
    }

    init(activityId: String) {
        self.activityId = activityId
    }

    func perform() async throws -> some IntentResult {
        await SalahWidgetAPIClient.snooze(activityId: activityId)
        await SalahActivityIntentActions.snooze(activityId: activityId)
        return .result()
    }
}

struct IgnorePrayerIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Ignore"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Activity ID")
    var activityId: String

    init() {
        activityId = ""
    }

    init(activityId: String) {
        self.activityId = activityId
    }

    func perform() async throws -> some IntentResult {
        await SalahWidgetAPIClient.ignore(activityId: activityId)
        await SalahActivityIntentActions.end(
            activityId: activityId,
            completionState: .ignored,
            messageSnoozeUntil: nil
        )
        return .result()
    }
}

private enum SalahActivityIntentActions {
    static func snooze(activityId: String) async {
        guard let activity = activity(matching: activityId) else {
            return
        }

        var state = activity.content.state
        let snoozeUntil = min(Date().addingTimeInterval(10 * 60), state.endTime)
        state.completionState = .active
        state.snoozeUntil = snoozeUntil

        await activity.update(ActivityContent(state: state, staleDate: state.endTime))
    }

    static func end(
        activityId: String,
        completionState: SalahPrayerCompletionState,
        messageSnoozeUntil: Date?
    ) async {
        guard let activity = activity(matching: activityId) else {
            return
        }

        var state = activity.content.state
        state.completionState = completionState
        state.snoozeUntil = messageSnoozeUntil

        await activity.end(
            ActivityContent(state: state, staleDate: nil),
            dismissalPolicy: .immediate
        )
    }

    private static func activity(matching activityId: String) -> Activity<SalahActivityAttributes>? {
        Activity<SalahActivityAttributes>.activities.first { activity in
            activity.attributes.activityId == activityId || activity.id == activityId
        }
    }
}
