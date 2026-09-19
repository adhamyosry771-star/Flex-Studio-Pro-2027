/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export function normalizeDecoratedText(str: string | undefined | null): string {
  if (!str) return '';
  
  let result = '';
  // Use Array.from to correctly split by surrogate pairs/code points
  const codePoints = Array.from(str);
  
  for (const char of codePoints) {
    const cp = char.codePointAt(0);
    if (!cp) {
      result += char;
      continue;
    }
    
    // 1. Skip Egyptian Hieroglyphs commonly used in Arabic nicknames (e.g. 𓆩, 𓆪, 𓍼)
    // which render as boxes/tofu on most devices
    if (cp >= 0x13000 && cp <= 0x1342F) {
      continue;
    }

    // 2. Strip Arabic Tashkeel (diacritics) and Tatweel/Kashida (ـ) that make text look cluttered/mangled
    if (cp >= 0x064B && cp <= 0x065F) {
      continue; // Skip diacritics
    }
    if (cp === 0x0670) {
      continue; // Skip superscript alef
    }
    if (cp === 0x0640) {
      continue; // Skip Tatweel/Kashida
    }

    // 3. Mathematical alphanumeric mappings (Text Table Styles)
    // Bold Upper
    if (cp >= 0x1D400 && cp <= 0x1D419) {
      result += String.fromCodePoint(cp - 0x1D400 + 65);
    }
    // Bold Lower
    else if (cp >= 0x1D41A && cp <= 0x1D433) {
      result += String.fromCodePoint(cp - 0x1D41A + 97);
    }
    // Italic Upper
    else if (cp >= 0x1D434 && cp <= 0x1D44D) {
      result += String.fromCodePoint(cp - 0x1D434 + 65);
    }
    // Italic Lower
    else if (cp >= 0x1D44E && cp <= 0x1D467) {
      result += String.fromCodePoint(cp - 0x1D44E + 97);
    }
    // Bold Italic Upper
    else if (cp >= 0x1D468 && cp <= 0x1D481) {
      result += String.fromCodePoint(cp - 0x1D468 + 65);
    }
    // Bold Italic Lower
    else if (cp >= 0x1D482 && cp <= 0x1D49B) {
      result += String.fromCodePoint(cp - 0x1D482 + 97);
    }
    // Script Upper
    else if (cp >= 0x1D49C && cp <= 0x1D4B5) {
      result += String.fromCodePoint(cp - 0x1D49C + 65);
    }
    // Script Lower
    else if (cp >= 0x1D4B6 && cp <= 0x1D4CF) {
      result += String.fromCodePoint(cp - 0x1D4B6 + 97);
    }
    // Bold Script Upper
    else if (cp >= 0x1D4D0 && cp <= 0x1D4E9) {
      result += String.fromCodePoint(cp - 0x1D4D0 + 65);
    }
    // Bold Script Lower
    else if (cp >= 0x1D4EA && cp <= 0x1D503) {
      result += String.fromCodePoint(cp - 0x1D4EA + 97);
    }
    // Fraktur Upper
    else if (cp >= 0x1D504 && cp <= 0x1D51D) {
      result += String.fromCodePoint(cp - 0x1D504 + 65);
    }
    // Fraktur Lower
    else if (cp >= 0x1D51E && cp <= 0x1D537) {
      result += String.fromCodePoint(cp - 0x1D51E + 97);
    }
    // Double-struck Upper
    else if (cp >= 0x1D538 && cp <= 0x1D551) {
      result += String.fromCodePoint(cp - 0x1D538 + 65);
    }
    // Double-struck Lower
    else if (cp >= 0x1D552 && cp <= 0x1D56B) {
      result += String.fromCodePoint(cp - 0x1D552 + 97);
    }
    // Bold Fraktur Upper
    else if (cp >= 0x1D56C && cp <= 0x1D585) {
      result += String.fromCodePoint(cp - 0x1D56C + 65);
    }
    // Bold Fraktur Lower
    else if (cp >= 0x1D586 && cp <= 0x1D59F) {
      result += String.fromCodePoint(cp - 0x1D586 + 97);
    }
    // Sans-serif Upper
    else if (cp >= 0x1D5A0 && cp <= 0x1D5B9) {
      result += String.fromCodePoint(cp - 0x1D5A0 + 65);
    }
    // Sans-serif Lower
    else if (cp >= 0x1D5BA && cp <= 0x1D5D3) {
      result += String.fromCodePoint(cp - 0x1D5BA + 97);
    }
    // Sans-serif Bold Upper
    else if (cp >= 0x1D5D4 && cp <= 0x1D5ED) {
      result += String.fromCodePoint(cp - 0x1D5D4 + 65);
    }
    // Sans-serif Bold Lower
    else if (cp >= 0x1D5EE && cp <= 0x1D607) {
      result += String.fromCodePoint(cp - 0x1D5EE + 97);
    }
    // Sans-serif Italic Upper
    else if (cp >= 0x1D608 && cp <= 0x1D621) {
      result += String.fromCodePoint(cp - 0x1D608 + 65);
    }
    // Sans-serif Italic Lower
    else if (cp >= 0x1D622 && cp <= 0x1D63B) {
      result += String.fromCodePoint(cp - 0x1D622 + 97);
    }
    // Sans-serif Bold Italic Upper
    else if (cp >= 0x1D63C && cp <= 0x1D655) {
      result += String.fromCodePoint(cp - 0x1D63C + 65);
    }
    // Sans-serif Bold Italic Lower
    else if (cp >= 0x1D656 && cp <= 0x1D66F) {
      result += String.fromCodePoint(cp - 0x1D656 + 97);
    }
    // Monospace Upper
    else if (cp >= 0x1D670 && cp <= 0x1D689) {
      result += String.fromCodePoint(cp - 0x1D670 + 65);
    }
    // Monospace Lower
    else if (cp >= 0x1D68A && cp <= 0x1D6A3) {
      result += String.fromCodePoint(cp - 0x1D68A + 97);
    }
    // Circled Upper
    else if (cp >= 0x24B6 && cp <= 0x24CF) {
      result += String.fromCodePoint(cp - 0x24B6 + 65);
    }
    // Circled Lower
    else if (cp >= 0x24D0 && cp <= 0x24E9) {
      result += String.fromCodePoint(cp - 0x24D0 + 97);
    }
    // Parenthesized Lower
    else if (cp >= 0x249C && cp <= 0x24B5) {
      result += String.fromCodePoint(cp - 0x249C + 97);
    }
    // Fullwidth Upper
    else if (cp >= 0xFF21 && cp <= 0xFF3A) {
      result += String.fromCodePoint(cp - 0xFF21 + 65);
    }
    // Fullwidth Lower
    else if (cp >= 0xFF41 && cp <= 0xFF5A) {
      result += String.fromCodePoint(cp - 0xFF41 + 97);
    }
    // Circled numbers 1-9
    else if (cp >= 0x2460 && cp <= 0x2468) {
      result += String.fromCodePoint(cp - 0x2460 + 49);
    }
    // Circled 0
    else if (cp === 0x24EA) {
      result += '0';
    }
    // Fullwidth numbers 0-9
    else if (cp >= 0xFF10 && cp <= 0xFF19) {
      result += String.fromCodePoint(cp - 0xFF10 + 48);
    }
    else {
      // Map other specific lone characters that are frequently used in text-table
      const exceptions: { [key: number]: string } = {
        0x2102: 'C', 0x210D: 'H', 0x2115: 'N', 0x2119: 'P', 0x211A: 'Q', 0x211D: 'R', 0x2124: 'Z', // Double-struck
        0x212C: 'B', 0x2130: 'E', 0x2131: 'F', 0x210B: 'H', 0x2110: 'I', 0x2112: 'L', 0x2133: 'M', 0x2115_1: 'N', // Script exceptions
        0x212F: 'e', 0x210A: 'g', 0x2146: 'i', 0x210E: 'h', // italic / script h
        0x211C: 'R', 0x2128: 'Z', 0x2111: 'I', 0x210C: 'H', 0x212D: 'C' // Fraktur
      };
      if (exceptions[cp]) {
        result += exceptions[cp];
      } else {
        result += char;
      }
    }
  }
  return result;
}