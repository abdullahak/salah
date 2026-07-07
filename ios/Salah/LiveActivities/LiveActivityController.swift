import ActivityKit
import Foundation

struct PrayerActivityWindow: Equatable {
    var prayerName: PrayerName
    var prayerLabel: String
    var startTime: Date
    var endTime: Date
    var locationLabel: String

    var contentState: SalahActivityAttributes.ContentState {
        SalahActivityAttributes.ContentState(
            prayerName: prayerLabel,
            startTime: startTime,
            endTime: endTime,
            locationLabel: locationLabel,
            completionState: .active,
            snoozeUntil: nil
        )
    }

    static func current(
        today: [PrayerTimeEntry],
        tomorrow: [PrayerTimeEntry],
        locationLabel: String,
        now: Date = Date()
    ) -> PrayerActivityWindow? {
        guard !today.isEmpty else {
            return nil
        }

        for index in today.indices {
            let prayer = today[index]
            let nextPrayer = nextPrayer(after: index, today: today, tomorrow: tomorrow)

            guard let nextPrayer,
                  prayer.time <= now,
                  now < nextPrayer.time else {
                continue
            }

            return PrayerActivityWindow(
                prayerName: prayer.name,
                prayerLabel: prayer.label,
                startTime: prayer.time,
                endTime: nextPrayer.time,
                locationLabel: locationLabel
            )
        }

        return nil
    }

    private static func nextPrayer(
        after index: Array<PrayerTimeEntry>.Index,
        today: [PrayerTimeEntry],
        tomorrow: [PrayerTimeEntry]
    ) -> PrayerTimeEntry? {
        let nextIndex = today.index(after: index)

        if nextIndex < today.endIndex {
            return today[nextIndex]
        }

        return tomorrow.first
    }
}

@MainActor
final class LiveActivityController: ObservableObject {
    @Published private(set) var activeActivityId: String?
    @Published private(set) var statusMessage = "No Live Activity is running."

    private let apiClient = SalahAPIClient.shared

    var hasActiveActivity: Bool {
        activeActivityId != nil
    }

    init() {
        activeActivityId = Activity<SalahActivityAttributes>.activities.first?.id
        if activeActivityId != nil {
            statusMessage = "A Live Activity is already running."
        }
    }

    func start(window: PrayerActivityWindow) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            statusMessage = "Live Activities are disabled on this device."
            return
        }

        await endExistingActivityIfNeeded()

        do {
            let attributes = SalahActivityAttributes(activityId: UUID().uuidString)
            let activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: window.contentState, staleDate: window.endTime),
                pushType: .token
            )

            activeActivityId = activity.id
            statusMessage = "\(window.prayerLabel) Live Activity started."
            observePushTokenUpdates(for: activity)
        } catch {
            statusMessage = "Live Activity could not start: \(error.localizedDescription)"
        }
    }

    func update(window: PrayerActivityWindow) async {
        guard let activity = activeActivity else {
            statusMessage = "Start a Live Activity before updating it."
            return
        }

        await activity.update(ActivityContent(state: window.contentState, staleDate: window.endTime))
        statusMessage = "\(window.prayerLabel) Live Activity updated."
    }

    func end(completionState: SalahPrayerCompletionState = .ignored) async {
        guard let activity = activeActivity else {
            activeActivityId = nil
            statusMessage = "No Live Activity is running."
            return
        }

        var state = activity.content.state
        state.completionState = completionState
        state.snoozeUntil = nil

        await activity.end(
            ActivityContent(state: state, staleDate: nil),
            dismissalPolicy: .immediate
        )

        activeActivityId = nil
        statusMessage = completionState == .prayed ? "Prayer marked as prayed." : "Live Activity ended."
    }

    private var activeActivity: Activity<SalahActivityAttributes>? {
        if let activeActivityId,
           let matchingActivity = Activity<SalahActivityAttributes>.activities.first(where: { $0.id == activeActivityId }) {
            return matchingActivity
        }

        return Activity<SalahActivityAttributes>.activities.first
    }

    private func endExistingActivityIfNeeded() async {
        for activity in Activity<SalahActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }

        activeActivityId = nil
    }

    private func observePushTokenUpdates(for activity: Activity<SalahActivityAttributes>) {
        Task {
            for await token in activity.pushTokenUpdates {
                try? await apiClient.updateActivityToken(updateToken: token.hexEncodedString)
            }
        }
    }
}
