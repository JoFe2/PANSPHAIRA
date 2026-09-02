# README application-hierarchy visual

`application-hierarchy.html` is the editable source for
`../../assets/diagrams/layers/04-application-hierarchy-blueprint.png`.

The default render is the owner-selected `blueprint` theme at 1920×1080.
Additional query values (`precision`, `editorial`, `signal`, and `soft`) are
retained only as source-level design variants; the public README uses the
Blueprint Dark export.

Example deterministic Chromium export:

```sh
chromium \
  --headless=new \
  --hide-scrollbars \
  --allow-file-access-from-files \
  --window-size=1920,1080 \
  --screenshot=assets/diagrams/layers/04-application-hierarchy-blueprint.png \
  "file://$PWD/tools/readme-visuals/application-hierarchy.html?theme=blueprint"
```

The source reuses the checked-in PanSphaira positive/negative brand icons. No
remote font, image, script, analytics, or network dependency is required.
