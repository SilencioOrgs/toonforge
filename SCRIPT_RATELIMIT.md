# "Isang 4-Digit OTP Lang (Missing Rate Limiting)" — 2D-in-3D Short
Audio: `voice/ratelimit_voice.wav` (78.524 s, 48 kHz mono -> 2356 frames @ 30 fps)

## Voiceover Timestamp Map
- `0.00-2.58 s` (f0-77): Isang four-digit OTP lang ang harang...
- `3.15-7.60 s` (f95-228): Kaya hinulaan ng bot ng 10,000 times sa loob lang ng isang segundo.
- `8.30-12.97 s` (f249-389): Ito ang nangyayari kapag kulang sa rate limiting ang login o OTP endpoint mo.
- `13.42-15.58 s` (f403-467): Madali kang tamaan ng brute force attack.
- `17.00-23.99 s` (f510-720): Ganito 'yan. Ang isang four-digit code, may 10,000 combinations lang—from 0000 hanggang 9999.
- `24.61-28.08 s` (f738-842): Kung tao ang manghuhula, aabutin ng ilang oras.
- `28.56-37.32 s` (f857-1120): Pero kapag bot? Kaya nitong magbato ng thousands of requests per second... hanggang sa tamaan ang tamang code at makuha agad ang account.
- `38.96-46.45 s` (f1169-1394): Bakit nakalusot? Kasi walang bantay sa endpoint. Kahit ilang thousand wrong attempts... pinapa-try again lang.
- `46.84-50.29 s` (f1405-1509): Ang fix? Maglagay ng rate limiting at lockout.
- `50.29-59.71 s` (f1509-1791): Una, i-limit kung ilang requests lang ang allowed per minute—per IP at per account... block agad at lagyan ng cooldown o delay.
- `60.96-66.77 s` (f1829-2003): Pangalawa, i-expire agad ang OTP pagkatapos ng 3 to 5 failed attempts.
- `68.33-78.52 s` (f2050-2356): So tandaan: huwag hayaang unlimited ang attempts sa login o OTP mo.
