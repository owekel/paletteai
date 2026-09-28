// Curated colour data for each of the four classic "seasons". This is where
// the actual fashion knowledge lives — plain data, no logic — which keeps it
// easy to tweak or extend (e.g. splitting each season into its 12-season
// sub-variants later) without touching any component code.

import type { ColorPalette, ColorProfile, ColorSwatchData, Season } from '../types/colorProfile'

// Small helper so the palette data below reads as a plain list, not a
// wall of repeated `{ name: ..., hex: ..., description: ... }` objects.
function sw(name: string, hex: string, description: string): ColorSwatchData {
  return { name, hex, description }
}

const SPRING: ColorPalette = {
  best: [
    sw('Coral', '#FF6F59', 'A bright, warm pink-orange that mirrors a warm, glowing skin tone.'),
    sw('Warm Peach', '#FFB48A', 'Soft and warm — flattering close to the face without overpowering it.'),
    sw('Golden Yellow', '#F2C14E', 'A clear, sunny yellow that tends to suit warm, lighter colouring well.'),
    sw('Grass Green', '#6BA84F', 'Fresh and warm-leaning, good for adding energy without going cool.'),
    sw('Turquoise', '#2FB7A5', 'A warm-leaning blue-green that reads as vivid rather than icy.'),
    sw('Tomato Red', '#E8543E', 'A warm, juicy red — livelier than a blue-based red.'),
    sw('Periwinkle Blue', '#6C8EDB', 'A softened blue with warmth in it, easier to wear than a true cool blue.'),
    sw('Light Violet', '#9B87D6', 'A warm-leaning purple that keeps some brightness.'),
  ],
  neutrals: [
    sw('Camel', '#C69C6D', 'A warm tan that works as an easy base for almost any outfit.'),
    sw('Warm Ivory', '#F6F1E4', 'A softer alternative to stark white for warm colouring.'),
    sw('Golden Beige', '#D9C7A3', 'A warm neutral that pairs easily with the brighter colours above.'),
    sw('Warm Taupe', '#A38B6D', 'A muted, warm mid-tone that is easy to build around.'),
  ],
  useCarefully: [
    sw('Jet Black', '#1A1A1A', 'Can look harsh against lighter, warmer colouring — a soft charcoal often reads better.'),
    sw('Icy Blue', '#CDE7F0', 'A cool, frosted pastel that may sit at odds with a warm undertone.'),
    sw('Pure White', '#FFFFFF', 'Can look stark; an ivory or cream may create less harsh contrast.'),
    sw('Deep Burgundy', '#5C1F2E', 'A cool, very deep wine tone that can overwhelm lighter, warmer colouring.'),
  ],
  wardrobe: {
    tshirts: [sw('Coral', '#FF6F59', ''), sw('Golden Yellow', '#F2C14E', ''), sw('Turquoise', '#2FB7A5', ''), sw('Warm Ivory', '#F6F1E4', '')],
    dressShirts: [sw('Warm Ivory', '#F6F1E4', ''), sw('Periwinkle Blue', '#6C8EDB', ''), sw('Light Violet', '#9B87D6', ''), sw('Camel', '#C69C6D', '')],
    hoodiesSweaters: [sw('Grass Green', '#6BA84F', ''), sw('Camel', '#C69C6D', ''), sw('Tomato Red', '#E8543E', ''), sw('Golden Beige', '#D9C7A3', '')],
    jackets: [sw('Camel', '#C69C6D', ''), sw('Warm Taupe', '#A38B6D', ''), sw('Tomato Red', '#E8543E', ''), sw('Golden Beige', '#D9C7A3', '')],
    pants: [sw('Camel', '#C69C6D', ''), sw('Warm Taupe', '#A38B6D', ''), sw('Golden Beige', '#D9C7A3', ''), sw('Warm Ivory', '#F6F1E4', '')],
    accessories: [sw('Golden Yellow', '#F2C14E', 'Gold-toned metals tend to suit warm colouring better than silver.'), sw('Turquoise', '#2FB7A5', ''), sw('Coral', '#FF6F59', ''), sw('Camel', '#C69C6D', '')],
  },
  staples: [
    sw('Navy', '#2E3A5C', 'A warm-leaning navy rather than a stark, cool one.'),
    sw('Grey', '#9C9284', 'A warm "greige" reads better than a cool, flat grey.'),
    sw('White', '#FAF6EC', 'A soft, warm white instead of a stark cool white.'),
    sw('Black', '#2B2725', 'A softened near-black is usually easier to wear than true black.'),
    sw('Brown', '#7A4A2B', 'A warm chestnut brown.'),
    sw('Beige', '#D9C7A3', 'A warm, golden beige.'),
  ],
}

const SUMMER: ColorPalette = {
  best: [
    sw('Powder Blue', '#A9C6E8', 'A soft, cool blue that echoes a gentle, cool colouring.'),
    sw('Soft Lavender', '#B6A5D8', 'Muted and cool — gentle rather than bold.'),
    sw('Rose Pink', '#D98CA0', 'A cool-leaning pink with a soft, blended feel.'),
    sw('Sage Green', '#8FA88C', 'A quiet, greyed-down green.'),
    sw('Slate Blue', '#6E85B7', 'A muted mid-blue, easy to wear close to the face.'),
    sw('Soft Raspberry', '#C15C74', 'A cool berry tone with some depth, without being harsh.'),
    sw('Dusty Teal', '#5E9A96', 'A softened teal that stays cool rather than tropical-bright.'),
    sw('Mauve', '#A97C8E', 'A dusty, cool pink-purple that suits low-to-medium contrast well.'),
  ],
  neutrals: [
    sw('Soft Grey', '#ACACA6', 'A gentle, cool-leaning grey.'),
    sw('Dove Grey', '#C6C6C0', 'Lighter and softer than a flat neutral grey.'),
    sw('Chalk White', '#F1F0EA', 'A muted white, softer than a stark, bright white.'),
    sw('Soft Navy', '#38455E', 'A muted navy rather than a jet-black or bright royal blue.'),
  ],
  useCarefully: [
    sw('Bright Orange', '#E8622A', 'A warm, saturated colour that can feel at odds with cooler, softer colouring.'),
    sw('Jet Black', '#0D0D0D', 'Can read as harsher than the soft contrast this colouring tends to have.'),
    sw('Golden Yellow', '#F2C14E', 'A warm, high-energy yellow that may compete with a cool undertone.'),
    sw('Bright Tomato Red', '#E8543E', 'A very warm, vivid red that can overpower softer colouring.'),
  ],
  wardrobe: {
    tshirts: [sw('Powder Blue', '#A9C6E8', ''), sw('Rose Pink', '#D98CA0', ''), sw('Sage Green', '#8FA88C', ''), sw('Chalk White', '#F1F0EA', '')],
    dressShirts: [sw('Chalk White', '#F1F0EA', ''), sw('Powder Blue', '#A9C6E8', ''), sw('Soft Lavender', '#B6A5D8', ''), sw('Dove Grey', '#C6C6C0', '')],
    hoodiesSweaters: [sw('Mauve', '#A97C8E', ''), sw('Dusty Teal', '#5E9A96', ''), sw('Soft Navy', '#38455E', ''), sw('Dove Grey', '#C6C6C0', '')],
    jackets: [sw('Soft Navy', '#38455E', ''), sw('Slate Blue', '#6E85B7', ''), sw('Dove Grey', '#C6C6C0', ''), sw('Mauve', '#A97C8E', '')],
    pants: [sw('Soft Navy', '#38455E', ''), sw('Dove Grey', '#C6C6C0', ''), sw('Soft Grey', '#ACACA6', ''), sw('Chalk White', '#F1F0EA', '')],
    accessories: [sw('Soft Lavender', '#B6A5D8', 'Silver-toned metals tend to suit cool colouring better than gold.'), sw('Slate Blue', '#6E85B7', ''), sw('Mauve', '#A97C8E', ''), sw('Dusty Teal', '#5E9A96', '')],
  },
  staples: [
    sw('Navy', '#35415A', 'A soft, cool navy.'),
    sw('Grey', '#ACACA6', 'A cool dove grey.'),
    sw('White', '#F1F0EA', 'A soft chalk white rather than a stark one.'),
    sw('Black', '#2B2B2D', 'A soft charcoal reads gentler than true black.'),
    sw('Brown', '#7A6A5D', 'A cool, taupe-leaning brown.'),
    sw('Beige', '#C8BFAE', 'A cool, putty-toned beige.'),
  ],
}

const AUTUMN: ColorPalette = {
  best: [
    sw('Rust', '#B5502A', 'An earthy, warm orange-red that suits deeper warm colouring.'),
    sw('Olive Green', '#6B6B2E', 'A muted, warm green with an earthy pull.'),
    sw('Mustard', '#C99A2E', 'A rich, warm yellow rather than a bright lemon.'),
    sw('Terracotta', '#C1653C', 'A warm clay tone, easy to wear head-to-toe.'),
    sw('Forest Green', '#2F5D3A', 'A deep, warm-leaning green.'),
    sw('Deep Teal', '#1F5C56', 'A rich blue-green with warmth in its depth.'),
    sw('Chocolate Brown', '#5A3A22', 'A warm, deep brown that works like a second neutral.'),
    sw('Brick Red', '#9C3B2E', 'A muted, earthy red rather than a sharp true red.'),
  ],
  neutrals: [
    sw('Camel', '#B8895D', 'A rich, warm tan.'),
    sw('Warm Khaki', '#A69066', 'An earthy green-brown neutral.'),
    sw('Cream', '#EFE3C8', 'A warm off-white, easier to wear than stark white.'),
    sw('Chestnut Brown', '#6E4A32', 'A deep, warm brown that can stand in for black.'),
  ],
  useCarefully: [
    sw('Icy Pastel Pink', '#F3D6DE', 'A cool, frosted pastel that can look washed out against warm, deeper colouring.'),
    sw('Stark White', '#FFFFFF', 'Can look overly stark; a cream or ivory tends to sit more naturally.'),
    sw('Cool Fuchsia', '#D6368F', 'A cool, high-shock pink that can clash with a warm undertone.'),
    sw('Silver Grey', '#C7C7C7', 'A cool, flat grey that can look dull against warmer colouring.'),
  ],
  wardrobe: {
    tshirts: [sw('Mustard', '#C99A2E', ''), sw('Terracotta', '#C1653C', ''), sw('Olive Green', '#6B6B2E', ''), sw('Cream', '#EFE3C8', '')],
    dressShirts: [sw('Cream', '#EFE3C8', ''), sw('Camel', '#B8895D', ''), sw('Warm Khaki', '#A69066', ''), sw('Rust', '#B5502A', '')],
    hoodiesSweaters: [sw('Forest Green', '#2F5D3A', ''), sw('Chocolate Brown', '#5A3A22', ''), sw('Rust', '#B5502A', ''), sw('Deep Teal', '#1F5C56', '')],
    jackets: [sw('Chestnut Brown', '#6E4A32', ''), sw('Chocolate Brown', '#5A3A22', ''), sw('Forest Green', '#2F5D3A', ''), sw('Camel', '#B8895D', '')],
    pants: [sw('Chestnut Brown', '#6E4A32', ''), sw('Warm Khaki', '#A69066', ''), sw('Chocolate Brown', '#5A3A22', ''), sw('Olive Green', '#6B6B2E', '')],
    accessories: [sw('Mustard', '#C99A2E', 'Gold and bronze-toned metals tend to suit warm colouring better than silver.'), sw('Rust', '#B5502A', ''), sw('Deep Teal', '#1F5C56', ''), sw('Camel', '#B8895D', '')],
  },
  staples: [
    sw('Navy', '#2E3B4E', 'A muted, slightly warm navy.'),
    sw('Grey', '#8F8574', 'A warm "greige" rather than a cool flat grey.'),
    sw('White', '#F2E9D8', 'A warm ivory instead of a stark white.'),
    sw('Black', '#2A211A', 'A soft warm near-black; chocolate brown can also stand in for black.'),
    sw('Brown', '#6E4A32', 'A rich chestnut brown.'),
    sw('Beige', '#C7A97B', 'A warm camel-beige.'),
  ],
}

const WINTER: ColorPalette = {
  best: [
    sw('True Red', '#C8102E', 'A clear, blue-based red that suits bold, cool colouring.'),
    sw('Emerald Green', '#009B77', 'A vivid, cool-leaning green.'),
    sw('Royal Blue', '#1E3A8A', 'A saturated, clear blue with real presence.'),
    sw('Fuchsia', '#C6247A', 'A bold cool pink that can carry high contrast well.'),
    sw('Icy Blue', '#A9D4E8', 'A crisp, cool pastel — one of the few pastels that tends to suit this colouring.'),
    sw('Deep Purple', '#4B2E83', 'A rich, cool purple.'),
    sw('Hot Pink', '#E0447B', 'A bright, clear pink rather than a muted or dusty one.'),
    sw('Bright Teal', '#0E8C82', 'A clear, saturated blue-green.'),
  ],
  neutrals: [
    sw('Pure White', '#FFFFFF', 'A crisp white tends to suit higher-contrast, cooler colouring well.'),
    sw('True Black', '#0A0A0A', 'A genuine black, rather than a softened charcoal.'),
    sw('Charcoal Grey', '#3A3A3C', 'A deep, cool grey.'),
    sw('Icy Grey', '#C7CDD1', 'A cool, pale grey with a slightly blue cast.'),
  ],
  useCarefully: [
    sw('Burnt Orange', '#C1622A', 'A warm, muted tone that can look dull against bold, cool colouring.'),
    sw('Mustard Yellow', '#C99A2E', 'A warm, earthy yellow that may look muddy rather than crisp on this colouring.'),
    sw('Warm Beige', '#C7A97B', 'Can look flat against higher contrast; a cooler grey often works better.'),
    sw('Peach', '#F2B98A', 'A soft warm tone that may look washed out against bold, cool colouring.'),
  ],
  wardrobe: {
    tshirts: [sw('Icy Blue', '#A9D4E8', ''), sw('Fuchsia', '#C6247A', ''), sw('Emerald Green', '#009B77', ''), sw('Pure White', '#FFFFFF', '')],
    dressShirts: [sw('Pure White', '#FFFFFF', ''), sw('Icy Blue', '#A9D4E8', ''), sw('Icy Grey', '#C7CDD1', ''), sw('Royal Blue', '#1E3A8A', '')],
    hoodiesSweaters: [sw('True Red', '#C8102E', ''), sw('Deep Purple', '#4B2E83', ''), sw('Charcoal Grey', '#3A3A3C', ''), sw('Emerald Green', '#009B77', '')],
    jackets: [sw('True Black', '#0A0A0A', ''), sw('Charcoal Grey', '#3A3A3C', ''), sw('Royal Blue', '#1E3A8A', ''), sw('Deep Purple', '#4B2E83', '')],
    pants: [sw('True Black', '#0A0A0A', ''), sw('Charcoal Grey', '#3A3A3C', ''), sw('Icy Grey', '#C7CDD1', ''), sw('Royal Blue', '#1E3A8A', '')],
    accessories: [sw('True Red', '#C8102E', 'Silver, white gold, and platinum-toned metals tend to suit cool colouring better than gold.'), sw('Fuchsia', '#C6247A', ''), sw('Bright Teal', '#0E8C82', ''), sw('True Black', '#0A0A0A', '')],
  },
  staples: [
    sw('Navy', '#1B2A4A', 'A deep, true navy.'),
    sw('Grey', '#3A3A3C', 'A cool charcoal grey.'),
    sw('White', '#FFFFFF', 'A bright, pure white.'),
    sw('Black', '#0A0A0A', 'A true black — one of the few colouring types that wears this easily.'),
    sw('Brown', '#4A362B', 'A cool, espresso-leaning brown, used sparingly.'),
    sw('Beige', '#B8AFA3', 'A cool, muted taupe-beige, used sparingly.'),
  ],
}

const SEASON_PALETTES: Record<Season, ColorPalette> = {
  spring: SPRING,
  summer: SUMMER,
  autumn: AUTUMN,
  winter: WINTER,
}

// The palette is chosen from the profile's primary season. This is a
// deliberate V1 simplification — the palette varies with the user's
// detected colouring, but not with their exact hair/eye colour within a
// season. A natural next step (left for later) would be to blend in a few
// colours from `profile.secondarySeason` when one is present.
export function generatePalette(profile: ColorProfile): ColorPalette {
  return SEASON_PALETTES[profile.season]
}
