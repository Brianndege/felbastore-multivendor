# notify-slack (Composite Action)

Reusable GitHub composite action for sending Slack webhook notifications.

## Inputs

- `webhook_url` (required): Slack Incoming Webhook URL
- `message` (required): Text payload sent to Slack

## Example Usage

```yaml
- name: Notify Slack on failure
  if: failure() && secrets.INVENTORY_SCAN_SLACK_WEBHOOK_URL != ''
  uses: ./.github/actions/notify-slack
  with:
    webhook_url: ${{ secrets.INVENTORY_SCAN_SLACK_WEBHOOK_URL }}
    message: "❌ Workflow failed. Run: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

## Notes

- Action sends a plain JSON payload with the `text` field.
- Keep webhook URL in GitHub Secrets.
- Use workflow-level `if:` conditions to control when notifications fire.
