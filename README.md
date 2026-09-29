# Meet Benjamin Gruber

A quiet page for booking 30 minutes with Benjamin Gruber. Guests do not log in.

Times are `America/New_York`. Each of the next 21 evenings runs from 6:00pm through 8:00am the next morning, in 30-minute slots, seven days a week. If it is still before 8:00am, the evening already underway is included. One guest per slot.

Every meeting is at 50 Lexington Ave, Apt. 15A, New York.

## Storage

Bookings live in a private [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store named `meet-bookings`, one JSON object per slot. The store survives deploys, and a taken slot cannot be booked again.

Without `BLOB_READ_WRITE_TOKEN` (local development), bookings are written under `.data/bookings` instead.

## Environment

| Name | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Read-write token for the Blob store. Provisioned on Vercel with the store. |
| `BOOKING_WEBHOOK_URL` | Optional. Each new booking `POST`s JSON to this URL. |
| `BOOKING_WEBHOOK_KEY` | Optional. Sent as the `x-webhook-key` header when this is set. |

Webhook body:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "start": "2026-09-29T18:00:00-04:00",
  "durationMinutes": 30,
  "note": "",
  "sleepover": false,
  "location": "50 Lexington Ave, Apt. 15A, New York"
}
```

`start` is ISO 8601 with the America/New_York offset. `sleepover` is true only when the guest checks Sleepover. If `BOOKING_WEBHOOK_URL` is missing, the booking is still saved and confirmed, and the server logs that the invite webhook was not configured. This app does not send email.
