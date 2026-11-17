# "SQL Injection (SQLi)" — 2D-in-3D Short
Audio: `voice/sqli_voice.wav` (73.953 s, 48 kHz mono -> 2219 frames @ 30 fps)

## Voiceover Timestamp Map
- `0.00-4.98 s` (f0-149): Nag-type lang ng simpleng quote at 'OR 1=1' sa login box...
- `5.42-8.57 s` (f163-257): Biglang nakapasok bilang admin, kahit walang password.
- `9.24-12.92 s` (f277-388): Tinatawag itong SQL Injection, o SQLi.
- `14.92-23.28 s` (f448-698): Kapag dinidikit mo lang nang diretso ang input ng user sa loob ng SQL query...
- `23.84-35.46 s` (f715-1064): Binabasa ng database yung 'OR 1=1' bilang totoong SQL command... TRUE -> pasok sa admin account.
- `35.97-42.44 s` (f1079-1273): Parang guard na pinapa-verify lang ang pangalan mo pero sinunod ang secret command sa papel.
- `44.11-56.58 s` (f1323-1697): Ang fix? Parameterized queries / prepared statements (SQL hiwalay sa input).
- `57.12-65.06 s` (f1714-1952): Kahit mag-type ng quotes o SQL keywords, plain text lang ito sa database.
- `66.72-73.95 s` (f2002-2219): Always treat input as data, never as code.
