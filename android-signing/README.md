# Android signing

`sunline.p12` is a **public** FOSS upload key so GitHub Actions can produce an
installable release APK and later versions can overwrite the same app.

Password / alias: see `keystore.properties` (`sunline-public` / `sunline`).

Do **not** reuse this keystore for Play Store publishing. Generate a private
one if you ever ship to Google Play.
