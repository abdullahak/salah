import ActivityKit
import Foundation

@MainActor
final class SalahRemoteSync: ObservableObject {
    private let apiClient: SalahAPIClient
    private var pushToStartTask: Task<Void, Never>?
    private var activityUpdatesTask: Task<Void, Never>?
    private var observedActivityIds = Set<String>()

    init(apiClient: SalahAPIClient = .shared) {
        self.apiClient = apiClient
    }

    func start(state: SalahAppState) async {
        await sync(state: state)

        guard pushToStartTask == nil else {
            return
        }

        pushToStartTask = Task {
            for await token in Activity<SalahActivityAttributes>.pushToStartTokenUpdates {
                try? await apiClient.updateActivityToken(pushToStartToken: token.hexEncodedString)
            }
        }

        for activity in Activity<SalahActivityAttributes>.activities {
            observePushTokenUpdates(for: activity)
        }

        activityUpdatesTask = Task {
            for await activity in Activity<SalahActivityAttributes>.activityUpdates {
                await observePushTokenUpdates(for: activity)
            }
        }
    }

    func sync(state: SalahAppState) async {
        do {
            try await apiClient.register(state: state)
        } catch {
            // The native app remains fully local if the production API is temporarily unreachable.
        }
    }

    func updateSettings(state: SalahAppState) async {
        do {
            try await apiClient.updateSettings(state: state)
        } catch {
            await sync(state: state)
        }
    }

    private func observePushTokenUpdates(for activity: Activity<SalahActivityAttributes>) {
        guard observedActivityIds.insert(activity.id).inserted else {
            return
        }

        Task {
            for await token in activity.pushTokenUpdates {
                try? await apiClient.updateActivityToken(updateToken: token.hexEncodedString)
            }
        }
    }
}
