/* Nastro Blu category icons
   Illustrated, full-colour category icons (shaded, close to the design mockup).
   Used by app.js through window.NASTRO_ICONS.
   Pure SVG - no image files needed. Size is controlled by CSS
   (.cat-card .ic in style.css), so each SVG fills its parent box.
*/

(function () {
  function svg(body, label) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" ' +
      'role="img" aria-label="' + label + '" focusable="false" ' +
      'style="display:block;width:100%;height:100%">' +
      body +
      "</svg>"
    );
  }

  /* isometric sweet piece (kalakand) */
  function block(cx, cy, w, h, s) {
    var P = function (x, y) { return x + " " + y; };
    var top = "M" + P(cx, cy) + "L" + P(cx + w, cy + h) + "L" + P(cx, cy + 2 * h) + "L" + P(cx - w, cy + h) + "Z";
    var left = "M" + P(cx - w, cy + h) + "L" + P(cx, cy + 2 * h) + "L" + P(cx, cy + 2 * h + s) + "L" + P(cx - w, cy + h + s) + "Z";
    var right = "M" + P(cx, cy + 2 * h) + "L" + P(cx + w, cy + h) + "L" + P(cx + w, cy + h + s) + "L" + P(cx, cy + 2 * h + s) + "Z";
    var fy = cy + h;
    return (
      '<path d="' + left + '" fill="#b27a2c"/>' +
      '<path d="' + right + '" fill="#8f5f20"/>' +
      '<path d="' + top + '" fill="url(#nbSweet)" stroke="#e2bd70" stroke-width="0.7" stroke-linejoin="round"/>' +
      '<path d="M' + P(cx - w + 2, fy) + "L" + P(cx, cy + 1.2) + '" stroke="#f9e5ae" stroke-width="0.8" stroke-linecap="round" opacity="0.8"/>' +
      '<ellipse cx="' + (cx - 4) + '" cy="' + (fy - 0.5) + '" rx="2" ry="0.9" fill="#6ea43f" transform="rotate(-20 ' + (cx - 4) + " " + (fy - 0.5) + ')"/>' +
      '<ellipse cx="' + (cx + 3.5) + '" cy="' + (fy + 1.2) + '" rx="1.8" ry="0.8" fill="#8cbc55" transform="rotate(25 ' + (cx + 3.5) + " " + (fy + 1.2) + ')"/>' +
      '<ellipse cx="' + (cx + 0.5) + '" cy="' + (fy - 2) + '" rx="1.3" ry="0.7" fill="#5f9535"/>'
    );
  }

  window.NASTRO_ICONS = {
    /* ALL PRODUCTS - wine four-point sparkle */
    all: svg(
  `
    <defs>
      <linearGradient id="nbAll" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8e2a5a"/>
        <stop offset="1" stop-color="#5e1238"/>
      </linearGradient>
    </defs>

    <path
      d="M32 3
         C34.5 20 38 27.5 61 32
         C38 36.5 34.5 44 32 61
         C29.5 44 26 36.5 3 32
         C26 27.5 29.5 20 32 3Z"
      fill="url(#nbAll)"
    />
  `,
  "All Products"
),
    /* NATURALLY GROWN PRODUCE - fresh green leaves */
    produce: svg(
      `
      <defs>
        <linearGradient id="nbLfL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#c3df4a"/>
          <stop offset="0.55" stop-color="#7cbb2c"/>
          <stop offset="1" stop-color="#3f8a22"/>
        </linearGradient>
        <linearGradient id="nbLfR" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#b3d83c"/>
          <stop offset="0.55" stop-color="#6fb12a"/>
          <stop offset="1" stop-color="#3a8420"/>
        </linearGradient>
        <linearGradient id="nbLfC" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#4c9a26"/>
          <stop offset="1" stop-color="#c9e55a"/>
        </linearGradient>
      </defs>
      <!-- stem -->
      <path d="M31 60C31 52 31 45 32 36" fill="none" stroke="#5f9a2c" stroke-width="2.6" stroke-linecap="round"/>
      <!-- small side leaf -->
      <path d="M31 50C25 49 20 45 19 39C25 39 30 43 31 50Z" fill="url(#nbLfL)"/>
      <!-- left leaf -->
      <path d="M31 39C20 40 10 32 8 16C22 15 31 25 31 39Z" fill="url(#nbLfL)"/>
      <path d="M30 37C23 31 16 25 10 18" fill="none" stroke="#e1f49a" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>
      <path d="M26 33C23 32 20 30 18 28M22 28C20 28 18 27 16 25" fill="none" stroke="#e1f49a" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/>
      <!-- right leaf -->
      <path d="M33 39C34 24 44 11 58 9C60 25 49 38 33 39Z" fill="url(#nbLfR)"/>
      <path d="M35 37C43 28 50 19 57 11" fill="none" stroke="#e1f49a" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>
      <path d="M40 31C43 31 46 30 48 28M45 24C47 24 50 23 52 21" fill="none" stroke="#e1f49a" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/>
      <!-- top leaf -->
      <path d="M32 34C25 26 27 14 34 4C41 14 39 27 32 34Z" fill="url(#nbLfC)"/>
      <path d="M33 31C32 22 33 13 34 7" fill="none" stroke="#e8f8aa" stroke-width="1" stroke-linecap="round" opacity="0.85"/>
      `,
      "Naturally Grown Produce"
    ),

    /* COLD PRESSED OILS - oil press machine */
    oilPress: svg(
      `
      <defs>
        <linearGradient id="nbSteel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#85888c"/>
          <stop offset="0.35" stop-color="#eceded"/>
          <stop offset="0.7" stop-color="#b9bbbe"/>
          <stop offset="1" stop-color="#75787c"/>
        </linearGradient>
        <linearGradient id="nbWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9a6a3a"/>
          <stop offset="1" stop-color="#6d4521"/>
        </linearGradient>
        <linearGradient id="nbOil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6cc4d"/>
          <stop offset="1" stop-color="#c88a10"/>
        </linearGradient>
      </defs>
      <!-- legs / base -->
      <rect x="8" y="55" width="38" height="3.5" rx="1.2" fill="#5a3c20"/>
      <rect x="10" y="49" width="4" height="7" fill="#6d4521"/>
      <rect x="40" y="49" width="4" height="7" fill="#6d4521"/>
      <!-- motor housing + wheel -->
      <rect x="6" y="26" width="13" height="22" rx="3" fill="url(#nbWood)" stroke="#4d3016" stroke-width="1"/>
      <circle cx="12" cy="37" r="8" fill="#707377" stroke="#3b3d40" stroke-width="1.3"/>
      <circle cx="12" cy="37" r="5" fill="#9a9ca0"/>
      <circle cx="12" cy="37" r="1.8" fill="#3b3d40"/>
      <path d="M12 30V44M5 37H19M7 32L17 42M17 32L7 42" stroke="#52555a" stroke-width="0.9"/>
      <!-- barrel -->
      <rect x="18" y="31" width="28" height="11" rx="2.5" fill="url(#nbSteel)" stroke="#55585c" stroke-width="1"/>
      <path d="M23 32V41M28 32V41" stroke="#8a8d91" stroke-width="1"/>
      <!-- press tower -->
      <rect x="25" y="16" width="15" height="33" rx="2.5" fill="url(#nbSteel)" stroke="#55585c" stroke-width="1"/>
      <path d="M25 24H40M25 29H40M25 44H40" stroke="#8a8d91" stroke-width="1"/>
      <rect x="29" y="35" width="7" height="7" rx="1" fill="#60636a"/>
      <!-- hopper -->
      <path d="M22 5H43L39 16H26Z" fill="url(#nbSteel)" stroke="#55585c" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M25 7H40" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>
      <!-- spout + oil -->
      <rect x="45" y="35" width="6" height="4" rx="1" fill="#7d8084"/>
      <path d="M50 40C50 43 52.5 44.5 52.5 47.5C52.5 50.5 50.5 52.5 48.5 52.5C46.5 52.5 44.5 50.5 44.5 47.5C44.5 44.5 47 43 47 40Z" fill="url(#nbOil)"/>
      <ellipse cx="47.3" cy="48.5" rx="1.1" ry="1.8" fill="#fde9a0" opacity="0.85"/>
      `,
      "Cold Pressed Oils"
    ),

    /* KERALA SPICES & TEAS - red chillies */
    chilli: svg(
      `
      <defs>
        <linearGradient id="nbCh1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff5b46"/>
          <stop offset="0.6" stop-color="#e02a1d"/>
          <stop offset="1" stop-color="#a50f0a"/>
        </linearGradient>
        <linearGradient id="nbCh2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e8321f"/>
          <stop offset="1" stop-color="#8e0c08"/>
        </linearGradient>
        <linearGradient id="nbChLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7cc044"/>
          <stop offset="1" stop-color="#3f8a26"/>
        </linearGradient>
      </defs>
      <!-- back chillies -->
      <path d="M56 17C60 24 58 32 52 39C45 47 35 52 25 56C32 49 40 43 44 35C47 29 50 22 56 17Z" fill="url(#nbCh2)"/>
      <path d="M32 9C40 9 45 16 42 24C38 33 27 41 11 46C20 39 29 31 31 23C32 17 31 12 32 9Z" fill="url(#nbCh2)"/>
      <!-- front chilli -->
      <path d="M46 10C55 12 57 21 51 29C44 39 31 48 14 55C24 46 34 38 38 28C41 21 42 14 46 10Z" fill="url(#nbCh1)"/>
      <path d="M47 14C52 16 53 22 49 28" fill="none" stroke="#ffb9ac" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>
      <path d="M36 12C40 13 42 17 41 21" fill="none" stroke="#ff9a8a" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <!-- leaves -->
      <path d="M3 44C8 38 17 38 23 44C17 51 8 51 3 44Z" fill="url(#nbChLeaf)"/>
      <path d="M5 44C10 43 16 43 21 44" fill="none" stroke="#b6e08a" stroke-width="0.8" stroke-linecap="round"/>
      <path d="M10 57C11 50 18 46 26 49C25 56 18 60 10 57Z" fill="url(#nbChLeaf)"/>
      <path d="M13 56C17 54 21 52 24 50" fill="none" stroke="#b6e08a" stroke-width="0.8" stroke-linecap="round"/>
      <!-- stems -->
      <path d="M46 10C47 6 49 4 53 3" fill="none" stroke="#4b9328" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M32 9C32 5 34 3 38 2" fill="none" stroke="#4b9328" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M56 17C58 14 60 13 62 13" fill="none" stroke="#4b9328" stroke-width="2.2" stroke-linecap="round"/>
      `,
      "Kerala Spices and Teas"
    ),

    /* DAIRY & GHEE - glass milk bottle */
    milkBottle: svg(
      `
      <defs>
        <linearGradient id="nbGlass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#d5dde2"/>
          <stop offset="0.35" stop-color="#ffffff"/>
          <stop offset="1" stop-color="#c6d0d7"/>
        </linearGradient>
        <linearGradient id="nbLabel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7cc8f0"/>
          <stop offset="1" stop-color="#2f86bf"/>
        </linearGradient>
      </defs>
      <!-- cap -->
      <rect x="27" y="3" width="10" height="6" rx="2" fill="#d3dbe0" stroke="#9aa6af" stroke-width="1"/>
      <path d="M29 5.5H35" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      <!-- bottle -->
      <path d="M28 9H36V16C36 20 43 22 43 29V54C43 57.5 41 60 38 60H26C23 60 21 57.5 21 54V29C21 22 28 20 28 16Z"
            fill="url(#nbGlass)" stroke="#a9b5bd" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M28 13H36" stroke="#b6c1c8" stroke-width="1"/>
      <!-- label -->
      <circle cx="32" cy="40" r="9.5" fill="url(#nbLabel)" stroke="#ffffff" stroke-width="1.3"/>
      <path d="M25.5 41C28 37.5 31 37.5 32 40C33 42.5 36 42.5 38.5 39" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M27 45C29.5 43 31 43.8 32 45C33 46 35 46 37 44" fill="none" stroke="#d6efff" stroke-width="1.2" stroke-linecap="round"/>
      <!-- highlight -->
      <path d="M24.5 30V52" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>
      <path d="M31 11V15" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>
      `,
      "Dairy and Ghee"
    ),

    /* KASHMIRI DRY FRUITS - walnuts with a leaf */
    walnut: svg(
      `
      <defs>
        <radialGradient id="nbNut" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stop-color="#deb27a"/>
          <stop offset="1" stop-color="#8c5f2c"/>
        </radialGradient>
        <radialGradient id="nbKernel" cx="0.4" cy="0.3" r="0.9">
          <stop offset="0" stop-color="#f3dcae"/>
          <stop offset="1" stop-color="#c79a56"/>
        </radialGradient>
      </defs>
      <!-- leaf -->
      <path d="M40 12C44 4 54 3 59 8C55 16 46 17 40 12Z" fill="#5aa532"/>
      <path d="M42 12L56 7" stroke="#3f7d22" stroke-width="1.1" stroke-linecap="round"/>
      <!-- back walnut (left) -->
      <path d="M19 14C8 14 3 23 4 31C5 40 12 46 20 46C29 46 34 39 34 30C34 21 29 14 19 14Z" fill="url(#nbNut)" stroke="#6b4720" stroke-width="1.4"/>
      <path d="M19 15C15 22 16 29 19 34C16 38 16 42 19 46" fill="none" stroke="#6b4720" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M9 22C12 24 14 27 14 31M28 22C25 25 24 28 24 32M10 38C13 37 15 39 16 42" fill="none" stroke="#7d5427" stroke-width="1.1" stroke-linecap="round"/>
      <!-- back walnut (right) -->
      <path d="M44 12C34 12 29 21 30 29C31 38 38 44 46 44C55 44 60 37 60 28C60 19 54 12 44 12Z" fill="url(#nbNut)" stroke="#6b4720" stroke-width="1.4"/>
      <path d="M44 13C40 20 41 27 44 32C41 36 41 40 44 44" fill="none" stroke="#6b4720" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M35 20C38 22 40 25 40 29M53 20C50 23 49 26 49 30M36 36C39 35 41 37 42 40" fill="none" stroke="#7d5427" stroke-width="1.1" stroke-linecap="round"/>
      <!-- front walnut -->
      <path d="M32 24C22 24 17 32 18 40C19 48 25 54 33 54C41 54 46 47 46 39C46 31 41 24 32 24Z" fill="url(#nbNut)" stroke="#6b4720" stroke-width="1.4"/>
      <path d="M32 25C28 32 29 39 32 44C29 48 29 51 32 54" fill="none" stroke="#6b4720" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M23 31C26 33 28 36 28 40M41 31C38 34 37 37 37 41M24 46C27 45 29 47 30 50" fill="none" stroke="#7d5427" stroke-width="1.1" stroke-linecap="round"/>
      <!-- kernel halves -->
      <path d="M5 49C2 53 5 59 12 59C18 59 22 56 22 52C22 48 16 46 12 48C9 46 6 46 5 49Z" fill="url(#nbKernel)" stroke="#a87a3a" stroke-width="1.1"/>
      <path d="M9 52C12 51 14 53 15 56" fill="none" stroke="#a87a3a" stroke-width="0.9" stroke-linecap="round"/>
      <path d="M44 51C42 55 45 60 51 60C57 60 60 57 59 53C58 49 52 48 49 50C47 48 45 48 44 51Z" fill="url(#nbKernel)" stroke="#a87a3a" stroke-width="1.1"/>
      <path d="M48 54C51 53 53 55 54 57" fill="none" stroke="#a87a3a" stroke-width="0.9" stroke-linecap="round"/>
      `,
      "Kashmiri Dry Fruits"
    ),

    /* TRADITIONAL SWEETS & SNACKS - kalakand pieces */
    kalakand: svg(
      `
      <defs>
        <linearGradient id="nbSweet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f6dc96"/>
          <stop offset="1" stop-color="#d9a84a"/>
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="55" rx="24" ry="3.5" fill="#000" opacity="0.08"/>
      ` +
        block(23, 8, 9, 4.5, 9, "nbSweet") +
        block(41, 8, 9, 4.5, 9, "nbSweet") +
        block(14, 19, 9, 4.5, 9, "nbSweet") +
        block(32, 19, 9, 4.5, 9, "nbSweet") +
        block(50, 19, 9, 4.5, 9, "nbSweet") +
        block(23, 30, 9, 4.5, 9, "nbSweet") +
        block(41, 30, 9, 4.5, 9, "nbSweet"),
      "Traditional Sweets and Snacks"
    ),

    /* HONEY - amber jar with wooden dipper */
    honey: svg(
      `
      <defs>
        <linearGradient id="nbHoney" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffd25a"/>
          <stop offset="0.55" stop-color="#f0a21c"/>
          <stop offset="1" stop-color="#c46f0a"/>
        </linearGradient>
        <linearGradient id="nbLid" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#a9722f"/>
          <stop offset="0.4" stop-color="#d9a35a"/>
          <stop offset="1" stop-color="#8a5a22"/>
        </linearGradient>
        <linearGradient id="nbDip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d9a35a"/>
          <stop offset="1" stop-color="#9a6528"/>
        </linearGradient>
      </defs>
      <ellipse cx="29" cy="59" rx="20" ry="3" fill="#000" opacity="0.08"/>
      <!-- dipper handle + head -->
      <path d="M50 6L38 30" stroke="url(#nbDip)" stroke-width="3.2" stroke-linecap="round"/>
      <ellipse cx="37" cy="33" rx="4.6" ry="3.6" fill="url(#nbDip)"/>
      <path d="M33 31L41 35M33 33.5L41 37.5" stroke="#7b4f1f" stroke-width="0.9"/>
      <path d="M36 37C36 41 38 42 38 45" stroke="#f0a21c" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <!-- jar -->
      <path d="M11 22H47V28C51 31 52 35 52 40V52C52 56 49 58 45 58H13C9 58 6 56 6 52V40C6 35 7 31 11 28Z"
            fill="url(#nbHoney)" stroke="#b86a0c" stroke-width="1.4" stroke-linejoin="round"/>
      <!-- lid -->
      <rect x="9" y="12" width="40" height="10" rx="2.5" fill="url(#nbLid)" stroke="#7b4f1f" stroke-width="1.2"/>
      <path d="M13 15.5H45" stroke="#f1d9a8" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>
      <!-- label -->
      <path d="M14 36H44V50H14Z" fill="#fff3d6" stroke="#c98a2b" stroke-width="1"/>
      <path d="M29 38.5L33.5 41.1V46.3L29 48.9L24.5 46.3V41.1Z" fill="#f0a21c" stroke="#b86a0c" stroke-width="0.9"/>
      <path d="M27 43.7H31M28 45.7H30" stroke="#fff3d6" stroke-width="0.9" stroke-linecap="round"/>
      <!-- highlight -->
      <path d="M10.5 33V50" stroke="#fff1b8" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
      `,
      "Honey"
    ),

    /* NASTRO BLU SPECIAL SQUASHES - orange squash bottle with a citrus slice */
    squash: svg(
      `
      <defs>
        <linearGradient id="nbSqJ" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffb347"/>
          <stop offset="0.55" stop-color="#f2780c"/>
          <stop offset="1" stop-color="#d4560a"/>
        </linearGradient>
        <linearGradient id="nbSqCap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#a9722f"/>
          <stop offset="0.4" stop-color="#e3b25f"/>
          <stop offset="1" stop-color="#8a5a22"/>
        </linearGradient>
        <linearGradient id="nbSqOr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffc04d"/>
          <stop offset="1" stop-color="#f28a14"/>
        </linearGradient>
      </defs>
      <ellipse cx="34" cy="60" rx="26" ry="3" fill="#000" opacity="0.08"/>
      <!-- bottle -->
      <path d="M17 11H31V18C31 21 37 24 37 30V54C37 57.5 34.5 59 31.5 59H16.5C13.5 59 11 57.5 11 54V30C11 24 17 21 17 18Z"
            fill="url(#nbSqJ)" stroke="#c4560a" stroke-width="1.3" stroke-linejoin="round"/>
      <!-- empty glass neck above the liquid -->
      <path d="M18 12H30V18C30 19.2 31 20.2 32.5 21.2C28 20.2 20 20.2 15.5 21.2C17 20.2 18 19.2 18 18Z" fill="#fff4dc" opacity="0.9"/>
      <!-- cap -->
      <rect x="15.5" y="4" width="17" height="8" rx="2" fill="url(#nbSqCap)" stroke="#7b4f1f" stroke-width="1.2"/>
      <path d="M19 6V10M22 6V10M25 6V10M28 6V10" stroke="#7b4f1f" stroke-width="0.8" opacity="0.45"/>
      <!-- label -->
      <path d="M13 34H35V50H13Z" fill="#fff6dd" stroke="#d9962b" stroke-width="1"/>
      <circle cx="24" cy="42" r="5" fill="#f28a14" stroke="#c4560a" stroke-width="0.8"/>
      <path d="M24 37V47M19 42H29M20.5 38.5L27.5 45.5M27.5 38.5L20.5 45.5" stroke="#fff1c9" stroke-width="0.7" opacity="0.9"/>
      <!-- highlight -->
      <path d="M13.8 31V52" stroke="#fff1c9" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <!-- citrus slice -->
      <circle cx="47" cy="47" r="12" fill="#f08a1c" stroke="#c4560a" stroke-width="1.2"/>
      <circle cx="47" cy="47" r="10" fill="#fff1c9"/>
      <circle cx="47" cy="47" r="9" fill="url(#nbSqOr)"/>
      <path d="M47 38.5V55.5M38.5 47H55.5M41 41L53 53M53 41L41 53" stroke="#fff1c9" stroke-width="1" stroke-linecap="round"/>
      <circle cx="47" cy="47" r="1.4" fill="#fff1c9"/>
      <!-- leaf -->
      <path d="M52 33C56 31 60 33 61 37C57 38 53 37 52 33Z" fill="#5f9a2c"/>
      <path d="M53 34.5C56 34 58.5 35 60 36.5" stroke="#bfe08a" stroke-width="0.7" fill="none" stroke-linecap="round"/>
      `,
      "Nastro Blu Special Squashes"
    )
  };
})();