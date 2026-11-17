# Design tokens

Defined in `packages/ui/src/tokens.css`. Two themes: light storefront (`:root`) and charcoal studio (`.gm-studio`, spec palette #101016 / #191922 / #FAF7F3 / blush #E6A7B0 / copper #BE8D70 / lavender #9C86EA / border #34303A / success #4B9B79). On the light theme the blush accent is darkened to #B4566A to keep AA contrast for text/buttons.

Spacing 4/8/12/16/24/32/48; minimum body text 16px; motion 160–240 ms with the `luxe` curve `cubic-bezier(.16,1,.3,1)`; all decorative motion is disabled under `prefers-reduced-motion`, and the hero has a pause control. Display font falls back to Didot/Georgia; UI font stack includes Noto Sans Arabic/Hebrew for RTL.
