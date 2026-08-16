/**
 * Swappable AI Image Generation Provider Module
 * Supports:
 * - Pollinations AI (Flux / SDXL - High-speed, high-resolution, unique illustrations per page)
 * - OpenAI (DALL-E 3)
 * - Stability AI (Ultra / Core)
 * - Replicate (Flux / SDXL)
 * - Procedural Thematic Multi-Scene SVG Fallback (for offline mode)
 */

/**
 * Builds a consistent character sheet and art style prompt
 */
function buildConsistentImagePrompt({ pageImagePrompt, avatar = {}, childName, artStyle }) {
  const skin = avatar.skinTone || 'warm peach';
  const hair = `${avatar.hairStyle || 'curly'} ${avatar.hairColor || 'dark brown'}`;
  const eyes = avatar.eyeColor || 'brown';
  const outfit = avatar.outfitColor || 'marigold yellow';
  const accessory = avatar.accessory && avatar.accessory !== 'none' ? `wearing ${avatar.accessory}` : '';

  const characterSheet = `Character description: A lovable young child named ${childName}, having ${skin} skin, ${hair} hair, ${eyes} eyes, dressed in ${outfit} clothing ${accessory}.`;

  const artStyleDescription = {
    watercolor: 'Gentle dreamy watercolor picture book illustration, soft pigment washes, delicate ink outlines, warm textured paper aesthetic',
    'soft cartoon': 'Charming 2D animated picture book style, rounded friendly shapes, vibrant pastel colors, clean storybook lines',
    'paper-cutout': 'Layered paper craft cutout style, tactile drop shadows, rich textured cardstock, whimsical handcrafted aesthetic',
    'whimsical gouache': 'Rich painterly gouache style, matte brushstrokes, warm joyful lighting, classic children storybook aesthetic',
    claymation: 'Cute 3D clay stop-motion style, soft plasticine textures, playful handcrafted characters, warm studio lighting',
    'digital picture book': 'Modern digital children picture book art, luminous atmospheric lighting, crisp friendly character design',
  }[artStyle] || 'Illustrated children picture book art, warm, vibrant, and joyful';

  return `${artStyleDescription}. ${characterSheet}. Specific scene action: ${pageImagePrompt}. High quality, award-winning storybook illustration, safe for children, no photographic or realistic adult faces, pure storybook art.`;
}

/**
 * Pollinations AI (Flux) Provider - Instant, high-resolution, distinct AI image per page
 */
async function generateWithPollinations(prompt, seed = Math.floor(Math.random() * 100000)) {
  const cleanPrompt = encodeURIComponent(prompt.slice(0, 900));
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
  return {
    url,
    provider: 'pollinations-flux',
  };
}

/**
 * OpenAI DALL-E 3 Provider
 */
async function generateWithOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 1000),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI error ${response.status}`);
  }

  return {
    url: data.data[0].url,
    provider: 'openai',
  };
}

/**
 * Stability AI Provider
 */
async function generateWithStability(prompt, apiKey) {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('output_format', 'webp');
  formData.append('aspect_ratio', '1:1');

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errors?.join(', ') || `Stability AI error ${response.status}`);
  }

  return {
    url: `data:image/webp;base64,${data.image}`,
    provider: 'stability',
  };
}

/**
 * Replicate (Flux-schnell / SDXL) Provider
 */
async function generateWithReplicate(prompt, apiKey) {
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      version: 'black-forest-labs/flux-schnell',
      input: {
        prompt: prompt,
        aspect_ratio: '1:1',
      },
    }),
  });

  const prediction = await createResponse.json();
  if (!createResponse.ok) {
    throw new Error(prediction.detail || 'Replicate initialization error');
  }

  let result = prediction;
  const pollUrl = prediction.urls.get;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    result = await pollRes.json();
    if (result.status === 'succeeded') {
      return {
        url: Array.isArray(result.output) ? result.output[0] : result.output,
        provider: 'replicate',
      };
    }
    if (result.status === 'failed' || result.status === 'canceled') {
      throw new Error(`Replicate generation ${result.status}: ${result.error}`);
    }
  }

  throw new Error('Replicate timed out');
}

/**
 * Procedural Dynamic Multi-Scene SVG Fallback (for offline mode)
 * Creates completely different scenery, time of day, and story actions per page number.
 */
function generateIllustratedFallbackArt({ pageNumber, childName, avatar = {}, artStyle, theme }) {
  const skin = avatar?.skinTone || '#F5D0A9';
  const hairColor = avatar?.hairColor || '#3D2314';
  const outfitColor = avatar?.outfitColor || '#F2A93B';
  const hairStyle = avatar?.hairStyle || 'curly';
  const accessory = avatar?.accessory || 'none';

  // Different color palettes per page to reflect narrative progression
  const pagePalettes = [
    // Page 1 / Cover: Morning Dawn & Beginning
    { sky1: '#FFEAA7', sky2: '#FAB1A0', sky3: '#81ECEC', ground1: '#55EFC4', ground2: '#00B894', time: 'Morning' },
    // Page 2: Vibrant Midday Journey
    { sky1: '#74B9FF', sky2: '#A29BFE', sky3: '#FFEAA7', ground1: '#FDCB6E', ground2: '#E17055', time: 'Afternoon' },
    // Page 3: Magic Twilight Climax
    { sky1: '#6C5CE7', sky2: '#FD79A8', sky3: '#FFAAA6', ground1: '#B8E994', ground2: '#079992', time: 'Twilight' },
    // Page 4: Cozy Starry Night & Celebration
    { sky1: '#2D3436', sky2: '#4B4B4B', sky3: '#6C5CE7', ground1: '#F8A5C2', ground2: '#F7D794', time: 'Night' },
  ];

  const pIndex = Math.min((pageNumber || 1) - 1, pagePalettes.length - 1);
  const palette = pagePalettes[pIndex] || pagePalettes[0];

  // Scenery features based on theme and page
  const lowerTheme = (theme || '').toLowerCase();
  let themeElements = '';

  if (lowerTheme.includes('space')) {
    themeElements = `
      <circle cx="680" cy="150" r="70" fill="#E84393" opacity="0.8" />
      <ellipse cx="680" cy="150" rx="110" ry="24" fill="none" stroke="#FEEAA7" stroke-width="8" transform="rotate(-20 680 150)" opacity="0.7" />
      <polygon points="120,80 125,95 140,95 128,105 132,120 120,110 108,120 112,105 100,95 115,95" fill="#FFEAA7" />
      <polygon points="350,120 354,130 365,130 356,138 359,150 350,142 341,150 344,138 335,130 346,130" fill="#FFF" />
      <path d="M 180 500 Q 220 300 280 260 Q 320 280 340 500 Z" fill="#D63031" opacity="0.85" />
      <polygon points="260,260 280,220 300,260" fill="#FFEAA7" />
    `;
  } else if (lowerTheme.includes('ocean')) {
    themeElements = `
      <circle cx="150" cy="200" r="18" fill="#FFF" opacity="0.4" />
      <circle cx="180" cy="150" r="12" fill="#FFF" opacity="0.5" />
      <circle cx="220" cy="120" r="8" fill="#FFF" opacity="0.6" />
      <path d="M 500 450 Q 600 400 700 450 Q 600 500 500 450 Z" fill="#00CEC9" />
      <polygon points="700,450 740,420 740,480" fill="#00CEC9" />
      <path d="M 100 750 Q 120 600 80 500 Q 140 600 160 750 Z" fill="#55EFC4" />
      <path d="M 680 750 Q 720 580 660 480 Q 740 580 760 750 Z" fill="#FF7675" />
    `;
  } else if (lowerTheme.includes('dinosaur')) {
    themeElements = `
      <polygon points="100,650 250,380 400,650" fill="#B3392F" />
      <ellipse cx="250" cy="380" rx="35" ry="15" fill="#E17055" />
      <path d="M 230 380 Q 250 280 270 380" stroke="#FAB1A0" stroke-width="12" fill="none" opacity="0.6" />
      <circle cx="620" cy="480" r="60" fill="#2ED573" />
      <path d="M 620 480 Q 720 420 750 360" stroke="#2ED573" stroke-width="30" stroke-linecap="round" fill="none" />
    `;
  } else {
    // Whimsical Forest / Castle / Adventure
    themeElements = `
      <circle cx="160" cy="480" r="80" fill="#2ED573" opacity="0.9" />
      <rect x="145" y="480" width="30" height="200" fill="#8E44AD" rx="4" />
      <circle cx="680" cy="440" r="95" fill="#1DD1A1" opacity="0.9" />
      <rect x="665" y="440" width="30" height="250" fill="#8E44AD" rx="4" />
      <path d="M 380 520 Q 400 380 440 380 Q 480 380 500 520 Z" fill="#F368E0" opacity="0.8" />
    `;
  }

  // Character movement pose based on page number
  const charX = pageNumber === 1 ? 260 : pageNumber === 2 ? 380 : pageNumber === 3 ? 240 : 340;
  const charY = 360;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad_${pageNumber}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.sky1}" />
      <stop offset="50%" stop-color="${palette.sky2}" />
      <stop offset="100%" stop-color="${palette.sky3}" />
    </linearGradient>
    <radialGradient id="celestialGlow_${pageNumber}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFDF0" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#FFEAA7" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background Sky Canvas -->
  <rect width="800" height="800" fill="url(#skyGrad_${pageNumber})" />

  <!-- Sun / Moon / Celestial Sphere -->
  <circle cx="${pageNumber % 2 === 0 ? 160 : 660}" cy="140" r="120" fill="url(#celestialGlow_${pageNumber})" />
  <circle cx="${pageNumber % 2 === 0 ? 160 : 660}" cy="140" r="45" fill="#FFFBEA" />

  <!-- Theme Specific Scenic Elements -->
  ${themeElements}

  <!-- Dynamic Rolling Hills / Ground -->
  <path d="M-50 600 Q 220 460, 500 580 T 850 540 L 850 850 L -50 850 Z" fill="${palette.ground1}" opacity="0.75" />
  <path d="M-50 680 Q 300 560, 540 660 T 850 630 L 850 850 L -50 850 Z" fill="${palette.ground2}" opacity="0.8" />
  <path d="M-50 730 Q 380 660, 850 700 L 850 850 L -50 850 Z" fill="#2E1F3D" opacity="0.85" />

  <!-- Illustrated Character -->
  <g transform="translate(${charX}, ${charY})">
    <!-- Ground Shadow -->
    <ellipse cx="80" cy="320" rx="85" ry="16" fill="#1A1124" opacity="0.3" />

    <!-- Body / Outfit -->
    <path d="M 40 190 Q 80 170 120 190 L 140 280 Q 80 290 20 280 Z" fill="${outfitColor}" />
    <!-- Arms -->
    <path d="M 35 195 Q ${pageNumber === 1 ? '10 170 20 150' : '5 230 15 250'} " stroke="${skin}" stroke-width="16" stroke-linecap="round" fill="none" />
    <path d="M 125 195 Q ${pageNumber === 3 ? '155 170 145 150' : '155 230 145 250'} " stroke="${skin}" stroke-width="16" stroke-linecap="round" fill="none" />
    
    <!-- Legs & Shoes -->
    <rect x="52" y="280" width="16" height="35" fill="#2E1F3D" rx="6" />
    <rect x="92" y="280" width="16" height="35" fill="#2E1F3D" rx="6" />
    <ellipse cx="58" cy="316" rx="14" ry="7" fill="#C4436B" />
    <ellipse cx="102" cy="316" rx="14" ry="7" fill="#C4436B" />

    <!-- Head & Ears -->
    <ellipse cx="38" cy="120" rx="8" ry="12" fill="${skin}" />
    <ellipse cx="122" cy="120" rx="8" ry="12" fill="${skin}" />
    <ellipse cx="80" cy="120" rx="42" ry="46" fill="${skin}" />

    <!-- Hair Styles -->
    ${
      hairStyle === 'curly'
        ? `<circle cx="50" cy="85" r="22" fill="${hairColor}" />
           <circle cx="80" cy="75" r="24" fill="${hairColor}" />
           <circle cx="110" cy="85" r="22" fill="${hairColor}" />
           <circle cx="38" cy="110" r="18" fill="${hairColor}" />
           <circle cx="122" cy="110" r="18" fill="${hairColor}" />`
        : hairStyle === 'afro'
        ? `<circle cx="80" cy="105" r="54" fill="${hairColor}" />`
        : hairStyle === 'pigtails'
        ? `<path d="M 35 90 Q 80 60 125 90 Q 80 80 35 90 Z" fill="${hairColor}" />
           <circle cx="25" cy="110" r="18" fill="${hairColor}" />
           <circle cx="135" cy="110" r="18" fill="${hairColor}" />`
        : hairStyle === 'spiky'
        ? `<polygon points="50,95 60,60 75,90 90,55 105,90 115,65 125,95" fill="${hairColor}" />`
        : `<path d="M 38 120 Q 40 70 80 70 Q 120 70 122 120 Q 80 85 38 120 Z" fill="${hairColor}" />`
    }

    <!-- Face Details -->
    <ellipse cx="65" cy="122" rx="5" ry="6" fill="#2E1F3D" />
    <ellipse cx="95" cy="122" rx="5" ry="6" fill="#2E1F3D" />
    <circle cx="67" cy="120" r="2" fill="#FFFFFF" />
    <circle cx="97" cy="120" r="2" fill="#FFFFFF" />
    <ellipse cx="54" cy="132" rx="7" ry="4" fill="#FF8B94" opacity="0.7" />
    <ellipse cx="106" cy="132" rx="7" ry="4" fill="#FF8B94" opacity="0.7" />
    <path d="M 68 140 Q 80 152 92 140" stroke="#8E2800" stroke-width="3" stroke-linecap="round" fill="none" />

    <!-- Optional Accessories -->
    ${
      accessory === 'glasses'
        ? `<circle cx="65" cy="122" r="12" stroke="#2E1F3D" stroke-width="2.5" fill="none" />
           <circle cx="95" cy="122" r="12" stroke="#2E1F3D" stroke-width="2.5" fill="none" />
           <line x1="77" y1="122" x2="83" y2="122" stroke="#2E1F3D" stroke-width="2.5" />`
        : accessory === 'crown'
        ? `<polygon points="55,80 65,60 80,72 95,60 105,80" fill="#F2A93B" stroke="#B87D1B" stroke-width="1.5" />`
        : accessory === 'cape'
        ? `<path d="M 40 190 Q 0 250 -10 300 L 40 280 Z" fill="#C4436B" />`
        : accessory === 'star-badge'
        ? `<polygon points="78,215 80,222 88,223 82,228 84,236 78,231 72,236 74,228 68,223 76,222" fill="#F2A93B" />`
        : ''
    }
  </g>

  <!-- Page Stamp Badge -->
  <g transform="translate(40, 40)">
    <rect width="120" height="36" rx="18" fill="#2E1F3D" opacity="0.85" />
    <text x="60" y="24" fill="#F6EBD3" font-family="'Fraunces', serif" font-size="15" font-weight="bold" text-anchor="middle">Page ${pageNumber}</text>
  </g>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Main generateStoryImage function
 * Tries the configured provider (OpenAI, Stability, Replicate, Pollinations).
 * If external API keys fail or are unavailable, seamlessly generates high-res AI images with Pollinations (Flux)
 * ensuring every page gets a completely unique, dynamic illustration!
 */
async function generateStoryImage({
  pageNumber,
  pageImagePrompt,
  avatar = {},
  childName,
  artStyle,
  theme,
}) {
  const provider = (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase();
  const apiKey = process.env.IMAGE_PROVIDER_API_KEY;

  const fullPrompt = buildConsistentImagePrompt({
    pageImagePrompt,
    avatar,
    childName,
    artStyle,
  });

  const seed = Math.floor(Date.now() / 1000) + (pageNumber || 1) * 31337;

  // 1. If explicit provider is OpenAI, Stability, or Replicate AND API key is present
  if (apiKey && (provider === 'openai' || provider === 'stability' || provider === 'replicate')) {
    try {
      console.log(`[ImageProvider] Generating illustration for Page ${pageNumber} via ${provider}...`);
      let result;
      if (provider === 'stability') {
        result = await generateWithStability(fullPrompt, apiKey);
      } else if (provider === 'replicate') {
        result = await generateWithReplicate(fullPrompt, apiKey);
      } else {
        result = await generateWithOpenAI(fullPrompt, apiKey);
      }

      return {
        ...result,
        prompt: fullPrompt,
      };
    } catch (apiError) {
      console.warn(`[ImageProvider Warning] Provider ${provider} failed (${apiError.message}). Seamlessly generating via Pollinations AI (Flux)...`);
    }
  }

  // 2. Pollinations AI (Flux / SDXL) - Always generates unique, high-resolution AI art per page
  try {
    console.log(`[ImageProvider] Generating unique AI illustration for Page ${pageNumber} via Pollinations (Flux)...`);
    const pollinationsResult = await generateWithPollinations(fullPrompt, seed);
    return {
      ...pollinationsResult,
      prompt: fullPrompt,
    };
  } catch (pollinationsErr) {
    console.error(`[ImageProvider Error] Pollinations failed: ${pollinationsErr.message}. Using dynamic multi-scene procedural fallback.`);
    const fallbackDataUri = generateIllustratedFallbackArt({
      pageNumber,
      childName,
      avatar,
      artStyle,
      theme,
    });
    return {
      url: fallbackDataUri,
      provider: 'fallback-stylized',
      prompt: fullPrompt,
      error: pollinationsErr.message,
    };
  }
}

module.exports = {
  buildConsistentImagePrompt,
  generateStoryImage,
  generateWithPollinations,
  generateIllustratedFallbackArt,
};
