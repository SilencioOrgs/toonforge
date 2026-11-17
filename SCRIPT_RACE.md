# "Race Condition: Two People, Isang Seat" — 2D-in-3D Short (Synced to Uploaded Voiceover)
Audio: `voice/race_voice.wav` (59.6375 s, 48 kHz mono -> 1790 frames @ 30 fps)

## Voiceover Timestamp Map
- `0.00-0.94 s` (f0-28): Two people.
- `1.40-2.11 s` (f42-63): Isang seat.
- `2.66-4.38 s` (f80-131): Parehong nakatanggap ng confirmation.
- `4.98-6.44 s` (f149-193): Paano nangyari 'yon?
- `7.11-8.95 s` (f213-268): Tinatawag itong race condition.
- `9.21-15.52 s` (f276-466): Ang ginagawa ng app mo, chine-check muna kung available ang seat, tapos saka sine-save ang booking.
- `15.95-17.84 s` (f479-535): Pero dalawang magkahiwalay na step 'yan.
- `18.26-24.32 s` (f548-730): Kapag sabay nag-click ang dalawang user, parehong sasabihin ng check na "available," kaya parehong papasok ang booking.
- `24.71-33.76 s` (f741-1013): Ang fix? Gawin mo siyang isang step lang. Imbes na mag-check muna, i-update mo agad ang seat basta't available pa rin, tapos tingnan mo kung ilang row ang nag-change.
- `34.04-38.49 s` (f1021-1155): Kapag isa, sa'yo ang seat. Kapag zero, naunahan ka na ng iba.
- `38.92-47.52 s` (f1168-1426): Kung gusto mo ng extra protection, magdagdag ng unique constraint sa seat. Kahit may bug ang code mo, ang database mismo ang magre-reject sa pangalawang booking.
- `47.87-59.36 s` (f1436-1781): So tandaan: huwag basta magtiwala sa "check, then save." Hayaan mong ang database ang mag-enforce ng rule, at magpakita ng friendly message sa pangalawang user: "Sorry, kakakuha lang ng seat na 'yon."
