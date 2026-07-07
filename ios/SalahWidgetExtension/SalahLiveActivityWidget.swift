import ActivityKit
import SwiftUI
import WidgetKit

struct SalahLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SalahActivityAttributes.self) { context in
            liveActivityView(context)
                .activityBackgroundTint(Color(.systemBackground))
                .activitySystemActionForegroundColor(.accentColor)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading) {
                        Text(context.state.prayerName)
                            .font(.headline)
                        Text(context.state.locationLabel)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    countdownView(context)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    actionButtons(context)
                }
            } compactLeading: {
                Text(shortPrayerName(context.state.prayerName))
                    .font(.caption.bold())
            } compactTrailing: {
                countdownView(context)
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Image(systemName: iconName(for: context.state))
            }
        }
    }

    private func liveActivityView(_ context: ActivityViewContext<SalahActivityAttributes>) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.state.prayerName)
                        .font(.title3.bold())
                    Text(context.state.locationLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text(context.state.completionState.label)
                        .font(.caption.bold())
                    countdownView(context)
                        .font(.headline.monospacedDigit())
                }
            }

            if let snoozeUntil = context.state.snoozeUntil {
                Label("Snoozed until \(snoozeUntil, style: .time)", systemImage: "moon.zzz")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            actionButtons(context)
        }
        .padding()
    }

    private func actionButtons(_ context: ActivityViewContext<SalahActivityAttributes>) -> some View {
        HStack(spacing: 12) {
            Button(intent: PrayedPrayerIntent(activityId: context.attributes.activityId)) {
                Label("Prayed", systemImage: "checkmark.circle.fill")
            }

            Button(intent: SnoozePrayerIntent(activityId: context.attributes.activityId)) {
                Label("Snooze", systemImage: "moon.zzz.fill")
            }

            Button(intent: IgnorePrayerIntent(activityId: context.attributes.activityId)) {
                Label("Ignore", systemImage: "xmark.circle.fill")
            }
        }
        .font(.caption)
        .buttonStyle(.bordered)
    }

    private func countdownView(_ context: ActivityViewContext<SalahActivityAttributes>) -> some View {
        Text(timerInterval: context.state.startTime...context.state.endTime, countsDown: true)
            .monospacedDigit()
    }

    private func shortPrayerName(_ prayerName: String) -> String {
        String(prayerName.prefix(3))
    }

    private func iconName(for state: SalahActivityAttributes.ContentState) -> String {
        switch state.completionState {
        case .active:
            return state.snoozeUntil == nil ? "clock" : "moon.zzz"
        case .prayed:
            return "checkmark.circle"
        case .ignored:
            return "xmark.circle"
        }
    }
}
