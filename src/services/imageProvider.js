/**
 * Swappable AI Image Generation Provider Module
 * Supports:
 * - OpenAI (DALL-E 3)
 * - Stability AI (Ultra / Core)
 * - Replicate (Flux / SDXL)
 * - Built-in High-Fidelity Thematic Illustrator fallback (for offline/test mode)
 */

/**
 * Builds a consistent character sheet and art style prompt
 */
function buildConsistentImagePrompt({ pageImagePrompt, avatar, childName, artStyle }) {
  const skin = avatar.skinTone || 'warm peach';
  const hair = `${avatar.hairStyle || 'curly'} ${avatar.hairColor || 'dark brown'}`;
  const eyes = avatar.eyeColor || 'brown';
  const outfit = avatar.outfitColor || 'marigold yellow';
  const accessory = avatar.accessory && avatar.accessory !== 'none' ? `wearing ${avatar.accessory}` : '';

  const characterSheet = `Character description: A lovable young child named ${childName}, having ${skin} skin, ${hair} hair, ${eyes} eyes, dressed in ${outfit} clothing ${accessory}.`;

  const artStyleDescription = {
    watercolor: 'Gentle dreamy watercolor illustration, soft pigment washes, delicate ink outlines, warm textured paper look',
    'soft cartoon': 'Charming 2D animated picture book style, rounded friendly shapes, vibrant pastel colors, clean storybook lines',
    'paper-cutout': 'Layered paper craft cutout style, tactile drop shadows, rich textured cardstock, whimsical handcrafted aesthetic',
    'whimsical gouache': 'Rich painterly gouache style, matte brushstrokes, warm joyful lighting, classic children storybook aesthetic',
    claymation: 'Cute 3D clay stop-motion style, soft plasticine textures, playful handcrafted characters, warm studio lighting',
    'digital picture book': 'Modern digital children picture book art, luminous atmospheric lighting, crisp friendly character design',
  }[artStyle] || 'Illustrated children picture book art, warm and joyful';

  return `${artStyleDescription}. ${characterSheet}. Scene: ${pageImagePrompt}. High quality, award-winning picture book art, safe for children, no photographic or realistic human faces, pure storybook art.`;
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

  // Base64 image
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

  // Poll for completion (up to 30s)
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
 * High-quality procedural SVG / styled fallback illustration
 * Renders an illustrated scene with character avatar traits, art style palettes, and whimsical scenery.
 */
function generateIllustratedFallbackArt({ pageNumber, childName, avatar, artStyle, theme }) {
  const skin = avatar?.skinTone || '#F5D0A9';
  const hairColor = avatar?.hairColor || '#3D2314';
  const outfitColor = avatar?.outfitColor || '#F2A93B';
  const hairStyle = avatar?.hairStyle || 'curly';
  const accessory = avatar?.accessory || 'none';

  // Palette themes
  const styleGradients = {
    watercolor: ['#B8D8D8', '#7A9E9F', '#EEF5DB', '#FE5F55'],
    'soft cartoon': ['#FFD166', '#06D6A0', '#118AB2', '#EF476F'],
    'paper-cutout': ['#E76F51', '#F4A261', '#E9C46A', '#2A9D8F'],
    'whimsical gouache': ['#4C8B5B', '#F2A93B', '#C4436B', '#2E1F3D'],
    claymation: ['#FFAAA6', '#FF8B94', '#FFD3B6', '#DCEDC1'],
    'digital picture book': ['#6C5CE7', '#A29BFE', '#FFEAA7', '#FAB1A0'],
  };

  const colors = styleGradients[artStyle] || styleGradients['watercolor'];
  const c1 = colors[0];
  const c2 = colors[1];
  const c3 = colors[2];
  const c4 = colors[3];

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="60%" stop-color="${c2}" />
      <stop offset="100%" stop-color="${c3}" />
    </linearGradient>
    <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFDF0" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#FFEAA7" stop-opacity="0" />
    </radialGradient>
    <filter id="softTexture" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.08 0" in="noise" result="coloredNoise" />
      <feBlend mode="multiply" in="SourceGraphic" in2="coloredNoise" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="800" height="800" fill="url(#skyGrad)" filter="url(#softTexture)" />

  <!-- Whimsical Celestial Glow -->
  <circle cx="680" cy="140" r="160" fill="url(#sunGlow)" />
  <circle cx="680" cy="140" r="45" fill="#FFFBEA" />

  <!-- Rolling Hills / Scenery -->
  <path d="M-50 620 Q 200 480, 480 600 T 850 560 L 850 850 L -50 850 Z" fill="${c3}" opacity="0.8" />
  <path d="M-50 690 Q 280 580, 520 680 T 850 650 L 850 850 L -50 850 Z" fill="${c4}" opacity="0.6" />
  <path d="M-50 740 Q 350 670, 850 720 L 850 850 L -50 850 Z" fill="#2E1F3D" opacity="0.85" />

  <!-- Story Elements & Stars -->
  <g fill="#FFFDF0" opacity="0.8">
    <circle cx="120" cy="180" r="4" />
    <circle cx="280" cy="100" r="5" />
    <circle cx="450" cy="160" r="3" />
    <circle cx="580" cy="80" r="4" />
    <polygon points="180,90 185,102 198,104 188,113 191,126 180,119 169,126 172,113 162,104 175,102" fill="#FFEAA7" opacity="0.7" transform="scale(0.8) translate(50, 40)" />
  </g>

  <!-- Illustrated Character -->
  <g transform="translate(320, 360)">
    <!-- Shadow -->
    <ellipse cx="80" cy="320" rx="90" ry="18" fill="#1A1124" opacity="0.35" />

    <!-- Body / Outfit -->
    <path d="M 40 190 Q 80 170 120 190 L 140 280 Q 80 290 20 280 Z" fill="${outfitColor}" />
    <!-- Arms -->
    <path d="M 35 195 Q 5 230 15 250" stroke="${skin}" stroke-width="16" stroke-linecap="round" fill="none" />
    <path d="M 125 195 Q 155 230 145 250" stroke="${skin}" stroke-width="16" stroke-linecap="round" fill="none" />
    
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

    <!-- Face Details: Big friendly eyes, rosy cheeks, warm smile -->
    <ellipse cx="65" cy="122" rx="5" ry="6" fill="#2E1F3D" />
    <ellipse cx="95" cy="122" rx="5" ry="6" fill="#2E1F3D" />
    <circle cx="67" cy="120" r="2" fill="#FFFFFF" />
    <circle cx="97" cy="120" r="2" fill="#FFFFFF" />
    <ellipse cx="54" cy="132" rx="7" ry="4" fill="#FF8B94" opacity="0.6" />
    <ellipse cx="106" cy="132" rx="7" ry="4" fill="#FF8B94" opacity="0.6" />
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
  <g transform="translate(60, 60)">
    <rect width="130" height="40" rx="20" fill="#2E1F3D" opacity="0.85" />
    <text x="65" y="26" fill="#F6EBD3" font-family="'Fraunces', serif" font-size="16" font-weight="bold" text-anchor="middle">Page ${pageNumber}</text>
  </g>
</svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Main generateImage function dispatched to configured provider
 */
async function generateStoryImage({
  pageNumber,
  pageImagePrompt,
  avatar,
  childName,
  artStyle,
  theme,
}) {
  const provider = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  const apiKey = process.env.IMAGE_PROVIDER_API_KEY;

  const fullPrompt = buildConsistentImagePrompt({
    pageImagePrompt,
    avatar,
    childName,
    artStyle,
  });

  if (!apiKey) {
    console.log(`[ImageProvider] No IMAGE_PROVIDER_API_KEY set. Generating high-resolution stylized visual art for Page ${pageNumber}.`);
    const fallbackDataUri = generateIllustratedFallbackArt({
      pageNumber,
      childName,
      avatar,
      artStyle,
      theme,
    });
    return {
      url: fallbackDataUri,
      provider: 'built-in-stylized',
      prompt: fullPrompt,
    };
  }

  try {
    console.log(`[ImageProvider] Generating illustration for Page ${pageNumber} via ${provider}...`);
    let result;
    if (provider === 'stability') {
      result = await generateWithStability(fullPrompt, apiKey);
    } else if (provider === 'replicate') {
      result = await generateWithReplicate(fullPrompt, apiKey);
    } else {
      // Default to OpenAI DALL-E 3
      result = await generateWithOpenAI(fullPrompt, apiKey);
    }

    return {
      ...result,
      prompt: fullPrompt,
    };
  } catch (error) {
    console.error(`[ImageProvider Error] Failed generating via ${provider}: ${error.message}. Using high-quality stylized fallback.`);
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
      error: error.message,
    };
  }
}

module.exports = {
  buildConsistentImagePrompt,
  generateStoryImage,
  generateIllustratedFallbackArt,
};
