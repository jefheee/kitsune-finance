---
name: Kitsune Finance Core
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#584235'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#8c7263'
  outline-variant: '#e0c0af'
  surface-tint: '#994700'
  primary: '#994700'
  on-primary: '#ffffff'
  primary-container: '#ff7a00'
  on-primary-container: '#5c2800'
  inverse-primary: '#ffb68b'
  secondary: '#575e70'
  on-secondary: '#ffffff'
  secondary-container: '#d9dff5'
  on-secondary-container: '#5c6274'
  tertiary: '#585f6c'
  on-tertiary: '#ffffff'
  tertiary-container: '#99a0af'
  on-tertiary-container: '#303743'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbc8'
  primary-fixed-dim: '#ffb68b'
  on-primary-fixed: '#321200'
  on-primary-fixed-variant: '#753400'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#dce2f3'
  tertiary-fixed-dim: '#c0c7d6'
  on-tertiary-fixed: '#151c27'
  on-tertiary-fixed-variant: '#404754'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is built on the principles of clarity, warmth, and financial empowerment. It avoids the cold, technical aesthetics often found in fintech, opting instead for a "Modern Minimalist" style that prioritizes human-centric interaction. The mood is welcoming and dependable, utilizing generous white space to reduce cognitive load and high-contrast elements to ensure universal accessibility. 

Key attributes:
- **Trustworthy:** Solid, grounded colors and clear hierarchy.
- **Approachable:** Softened edges and friendly typography.
- **Efficient:** No unnecessary ornamentation; every element serves a functional purpose.

## Colors
The palette is designed for maximum legibility and emotional resonance.
- **Sunset Orange (#FF7A00):** Used exclusively for primary actions, progress indicators, and key brand moments. It is high-energy but warm.
- **Deep Charcoal (#111827):** The foundation for all primary text and critical UI boundaries, ensuring WCAG AAA compliance against the light background.
- **Soft White (#F9FAFB):** The primary canvas color, chosen to reduce eye strain compared to pure white.
- **Secondary Accents:** Mid-tone grays (#6B7280) are used for secondary text and decorative icons to maintain a clear visual hierarchy.

## Typography
This design system utilizes **Hanken Grotesk** across all touchpoints. Its geometric yet open character strikes a balance between professional precision and modern friendliness. 

- **Headlines:** Use SemiBold (600) or Bold (700) weights with slightly tighter letter-spacing to create a strong visual anchor.
- **Body Text:** Use Regular (400) weight. Line heights are purposefully generous (1.5x+) to enhance readability for financial data and long-form content.
- **Labels:** Use Medium (500) or SemiBold (600) weights at smaller sizes to ensure they remain legible and distinct from body copy.

## Layout & Spacing
The layout relies on a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **Rhythm:** A strict 4px/8px baseline grid ensures vertical harmony.
- **Whitespace:** Emphasize "breathing room" by using `xxl` spacing between major sections and `lg` spacing between card components.
- **Adaptivity:** On mobile devices, side margins shrink to 16px to maximize screen real estate, while gutters remain at 16px to prevent visual crowding. Desktop views employ a centered container with a maximum width of 1280px to maintain readability on ultra-wide monitors.

## Elevation & Depth
Depth is conveyed through a combination of **Tonal Layering** and **Ambient Shadows**.

- **Level 0 (Base):** Soft White (#F9FAFB).
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF) with a subtle "Ambient Drop" shadow (0px 4px 20px rgba(17, 24, 39, 0.05)).
- **Level 2 (Modals/Popovers):** Pure White (#FFFFFF) with a more defined shadow (0px 12px 32px rgba(17, 24, 39, 0.1)).
- **Interactive Elements:** Buttons and clickable cards should not use heavy lift effects; instead, use a subtle 2px vertical shift or a slight darkening of the shadow on hover to simulate a physical press.

## Shapes
The shape language is defined by significant corner rounding to reinforce the friendly and modern brand persona. 

- **Standard Elements:** Buttons, input fields, and small tags use a **12px** (rounded-lg) radius.
- **Containers:** Large cards, modals, and primary layout sections use a **16px** (rounded-xl) radius.
- **Full Rounding:** Progress bars and specific search pill components may use "Pill-shaped" 100px rounding for distinct visual differentiation.

## Components
- **Buttons:** Primary buttons use a solid Sunset Orange background with White text. Secondary buttons use a Deep Charcoal outline (1.5px) with Charcoal text. Padding should be generous (12px vertical, 24px horizontal).
- **Inputs:** Fields use a 1.5px border in a light gray, shifting to Sunset Orange on focus. Labels sit clearly above the input in Medium weight charcoal.
- **Cards:** White backgrounds, 16px corner radius, and the Ambient Drop shadow. Content within cards should have at least 24px of internal padding.
- **Chips/Badges:** Use light tinted backgrounds (e.g., 10% opacity of the semantic color) with high-contrast text for status indicators (Success, Pending, Warning).
- **Data Tables:** Minimize borders; use subtle horizontal dividers only. Use Deep Charcoal for primary figures and Tertiary Gray for supporting metadata.
- **Progress Indicators:** Use thick 8px lines with fully rounded caps in Sunset Orange to track financial goals or onboarding steps.