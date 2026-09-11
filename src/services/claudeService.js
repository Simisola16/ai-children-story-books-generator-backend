const Anthropic = require('@anthropic-ai/sdk');

const CHILD_STORY_SYSTEM_PROMPT = (ageBand, pageCount, childName, avatar = {}) => `You are a world-class children's story writer and visual art director for an award-winning picture-book application.
You write complete, heartwarming, and engaging original storybook scripts where every page's illustration prompt directly and vividly depicts the scene taking place in that page's text.

### CORE WRITING GUIDELINES:
1. Match vocabulary and sentence length to age band "${ageBand}":
   - 3-5: very short sentences, simple concrete words, gentle repetition, joyful rhythm.
   - 6-8: engaging narrative, lively dialogue, rich sensory verbs, gentle curiosity.
   - 9-11: fuller sentences, imaginative world-building, clever problem solving, emotional resonance.

2. Tone: Warm, uplifting, magical, and reassuring. Always end with a positive, heartwarming resolution.
   - NEVER include violence, weapons, real-world hazards, sadness without resolution, or inappropriate themes.

### CRITICAL ART DIRECTION & VISUAL CONSISTENCY (IMAGE PROMPTS):
- For EVERY page, the "imagePrompt" field MUST DIRECTLY CORRELATE with the exact story event described in that page's "text".
- Every "imagePrompt" MUST describe:
  1. Main character ("${childName}", age 4-7 child, skin tone: ${avatar.skinTone || 'natural'}, hair: ${avatar.hairStyle || 'curly'} ${avatar.hairColor || 'dark brown'}, eyes: ${avatar.eyeColor || 'brown'}, outfit: ${avatar.outfitColor || 'colorful storybook outfit'}, accessory: ${avatar.accessory || 'none'}).
  2. The specific action and emotion of ${childName} (e.g. kneeling happily, reaching with curiosity, laughing joyfully, waving).
  3. The focal companions or objects mentioned in that page's text (e.g. friendly dragon, glowing telescope, sea turtle, starry glider).
  4. The background environment and atmospheric lighting (e.g. warm golden hour sunbeams, sparkling stardust, bioluminescent coral glow).
  5. Composition & framing (e.g. wide angle landscape, eye-level cinematic shot, cozy close-up).
- Standard negative directive appended to each prompt: "no text, no speech bubbles, no watermark, professional picture book illustration".

Output exactly ${pageCount} pages. Each page must contain both "text" and "imagePrompt". Return only the structured JSON.`;

/**
 * Builds the JSON schema for Anthropic Structured Outputs
 */
const getStoryJsonSchema = (pageCount) => ({
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'The heartwarming title of the children storybook',
    },
    moral: {
      type: 'string',
      description: 'A gentle 1-sentence positive takeaway or moral of the story',
    },
    pages: {
      type: 'array',
      minItems: pageCount,
      maxItems: pageCount,
      items: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The story text to be read on this page, matched to the child age band.',
          },
          imagePrompt: {
            type: 'string',
            description: 'A rich visual description of the illustrated scene showing the character and environment.',
          },
        },
        required: ['text', 'imagePrompt'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'moral', 'pages'],
  additionalProperties: false,
});

/**
 * Generates an illustrated storybook script using Claude API (Structured Outputs)
 */
async function generateStoryScript({
  childName,
  ageBand,
  avatar = {},
  theme,
  artStyle,
  pageCount = 4,
  customDetails = '',
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('[ClaudeService] ANTHROPIC_API_KEY not configured. Generating high-quality creative story via local narrative engine.');
    return generateLocalFallbackStory({ childName, ageBand, avatar, theme, artStyle, pageCount, customDetails });
  }

  const anthropic = new Anthropic({ apiKey });

  const characterSheet = `Main Character: "${childName}", skin tone: ${avatar.skinTone || 'fair'}, hair: ${avatar.hairStyle || 'curly'} ${avatar.hairColor || 'dark brown'}, eyes: ${avatar.eyeColor || 'brown'}, clothes: ${avatar.outfitColor || 'marigold yellow'}, accessory: ${avatar.accessory || 'none'}. Art style: ${artStyle}.`;

  const userPrompt = `Create a ${pageCount}-page children's storybook.
Character: ${characterSheet}
Theme: ${theme}
Age Band: ${ageBand}
Custom Details / Special Request: ${customDetails || 'A joyful journey of curiosity, kindness, and fun'}
Number of pages required: ${pageCount}

Ensure every page's imagePrompt perfectly matches the exact actions, emotions, and objects described in that page's text!`;

  const jsonSchema = getStoryJsonSchema(pageCount);

  const modelsToTry = [
    'claude-sonnet-5',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-haiku-4-5-20251001',
    'claude-3-5-haiku-20241022',
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[ClaudeService] Attempting text generation with model "${model}" (Structured Outputs, ${pageCount} pages)...`);
      
      const response = await anthropic.messages.create({
        model,
        max_tokens: 3000,
        system: CHILD_STORY_SYSTEM_PROMPT(ageBand, pageCount, childName, avatar),
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: jsonSchema,
          },
        },
      });

      let contentStr = '';
      if (response.content && response.content.length > 0) {
        contentStr = response.content[0].text;
      }

      const parsed = JSON.parse(contentStr);

      if (parsed.pages && parsed.pages.length === pageCount) {
        console.log(`[ClaudeService] Story generated successfully with ${model} ("${parsed.title}")`);
        return parsed;
      } else if (parsed.pages) {
        console.warn(`[ClaudeService] Page count mismatch (${parsed.pages.length} vs ${pageCount}), adjusting.`);
        while (parsed.pages.length < pageCount) {
          parsed.pages.push({
            text: `And so, ${childName} smiled knowing every day brings new wonders.`,
            imagePrompt: `Happy scene of ${childName} in ${artStyle} illustration style, smiling peacefully.`,
          });
        }
        parsed.pages = parsed.pages.slice(0, pageCount);
        return parsed;
      }
    } catch (err) {
      console.warn(`[ClaudeService] Model ${model} structured outputs call failed: ${err.message}`);
      lastError = err;
    }
  }

  console.error('[ClaudeService] All Anthropic Claude attempts encountered issues. Falling back to local generation.', lastError?.message);
  return generateLocalFallbackStory({ childName, ageBand, avatar, theme, artStyle, pageCount, customDetails });
}

/**
 * Creative fallback generator that dynamically crafts stories when API keys are not provided
 */
function generateLocalFallbackStory({ childName, ageBand, avatar = {}, theme, artStyle = 'watercolor', pageCount = 4, customDetails = '' }) {
  const themeLower = (theme || 'adventure').toLowerCase();
  const hairDesc = `${avatar.hairStyle || 'curly'} ${avatar.hairColor || 'dark brown'}`;
  const skinDesc = avatar.skinTone || 'warm peach';
  const outfitDesc = avatar.outfitColor || 'marigold yellow';
  const accessoryDesc = avatar.accessory && avatar.accessory !== 'none' ? `wearing ${avatar.accessory}` : '';

  const charDesc = `A happy young child named ${childName} with ${skinDesc} skin, ${hairDesc} hair, wearing a ${outfitDesc} outfit ${accessoryDesc}`;

  const storiesByTheme = {
    space: {
      title: `${childName}'s Galactic Star Safari`,
      moral: 'Curiosity and courage help us discover dazzling new horizons.',
      pageTemplates: [
        {
          text: `On a quiet starry evening, ${childName} put on a shiny silver helmet and looked up at the twinkling sky. A friendly little comet zoomed by with a playful wink!`,
          prompt: `${charDesc} sitting by an open bedroom window with a glowing telescope, watching a smiling golden comet streak across a starry indigo sky, ${artStyle} style, award-winning storybook illustration.`,
        },
        {
          text: `"Hop aboard!" chimed Cosmo the Space Otter from a glowing star-glider. Together, they zipped past the glittering rings of Neptune and danced through purple nebula clouds.`,
          prompt: `${charDesc} riding a luminous star-glider through purple cosmic nebulas alongside a cute cheerful space otter wearing goggles, sparkling stardust, ${artStyle} illustration.`,
        },
        {
          text: `They discovered the Whispering Moon, where glowing moon-flowers hummed gentle lullabies. ${childName} helped tuck in a tiny baby star with a starlight blanket.`,
          prompt: `${charDesc} gently placing a cozy starlight blanket over a sleepy smiling baby star on a soft crater landscape surrounded by glowing crystal moon-flowers, ${artStyle}.`,
        },
        {
          text: `Floating gently back into the cozy bedroom, ${childName} smiled warmly, knowing that wonderful adventures always await in our dreams. Goodnight, starry universe!`,
          prompt: `${charDesc} cozy in bed smiling peacefully under starry blankets, a friendly crescent moon glowing outside the window, serene warm ${artStyle} artwork.`,
        },
        {
          text: `With a heart full of stardust and wondrous memories, ${childName} knew that whenever you look up at the night sky, magic is always waiting to be found.`,
          prompt: `${charDesc} standing happily under a dazzling cosmic sky filled with colorful galaxies and smiling constellation animals, magical ${artStyle} style.`,
        },
      ],
    },
    forest: {
      title: `${childName} and the Whispering Enchanted Woods`,
      moral: 'Kindness to nature and friends always creates true magic.',
      pageTemplates: [
        {
          text: `Deep beneath the emerald tree canopies, ${childName} discovered a sparkling trail of golden dewdrops leading into a secret woodland clearing.`,
          prompt: `${charDesc} walking along a mossy enchanted forest path filled with glowing mushrooms and soft morning sunbeams, ${artStyle} storybook picture.`,
        },
        {
          text: `A fluffy red fox named Pip popped out from behind an ancient oak. "We are preparing the Great Forest Feast, but our berry basket spilled!" Pip squeaked.`,
          prompt: `${charDesc} kneeling down kindly with a sweet fluffy red fox next to a basket of bright blueberries and strawberries under a giant leafy tree, ${artStyle}.`,
        },
        {
          text: `${childName} smiled warmly and helped gather the sweetest sun-berries with the woodland hedgehogs and songbirds, singing cheerful tunes all afternoon.`,
          prompt: `${charDesc} laughing joyfully with woodland animals—rabbits, hedgehogs, and robins—sharing berries together in a sun-drenched meadow, ${artStyle}.`,
        },
        {
          text: `As the golden sunset painted the treetops, the forest creatures crowned ${childName} the Guardian of the Woods. "Thank you for your kind heart!" they cheered.`,
          prompt: `${charDesc} smiling proudly with a crown of woven green leaves and flowers, surrounded by happy forest creatures under a warm orange dusk, ${artStyle}.`,
        },
        {
          text: `Heading home with a jar of glowing fireflies, ${childName} waved goodbye to Pip, promising to return whenever the forest needed a helping hand.`,
          prompt: `${charDesc} waving goodbye to friendly forest animals while holding a softly glowing lantern on a woodland path, ${artStyle} illustration.`,
        },
      ],
    },
    ocean: {
      title: `${childName}'s Secret Coral Kingdom`,
      moral: 'When we listen with an open heart, every friend has something special to share.',
      pageTemplates: [
        {
          text: `While dipping toes into the warm turquoise sea, ${childName} met Marina the Dolphin, who offered a shimmering seashell necklace for an undersea visit.`,
          prompt: `${charDesc} sitting on a sunlit sandy shore as a friendly smiling dolphin leaps gently from sparkling turquoise waves, ${artStyle} picture book art.`,
        },
        {
          text: `Down into the reef they swam, surrounded by schools of glowing rainbow fish that lit up the coral towers like underwater castles.`,
          prompt: `${charDesc} swimming happily underwater alongside glowing schools of vibrant fish and colorful coral castles, magical bubbles, ${artStyle}.`,
        },
        {
          text: `They met Barnaby the wise sea turtle, who needed help finding his lost pearl glasses. ${childName} spotted them gently resting on a giant sea sponge!`,
          prompt: `${charDesc} handing a pair of funny round spectacles to a gentle smiling old sea turtle resting on soft sea anemones, ${artStyle}.`,
        },
        {
          text: `With a joyful splash, the sea creatures performed a synchronized bubble dance of gratitude. ${childName} waved goodbye with memories of pure wonder.`,
          prompt: `${charDesc} waving happily to sea turtles and playful dolphins in a sunlit reef, gentle shimmering water currents, ${artStyle} picture book style.`,
        },
        {
          text: `Sitting back on the sandy beach under the pastel sunset, ${childName} held the seashell necklace and listened to the peaceful ocean song.`,
          prompt: `${charDesc} sitting on the beach at twilight holding a glowing seashell to their ear, tranquil ocean waves, warm ${artStyle} artwork.`,
        },
      ],
    },
    dinosaur: {
      title: `${childName} and the Gentle Valley of Dinosaurs`,
      moral: 'True friendship comes in all shapes and sizes.',
      pageTemplates: [
        {
          text: `While exploring the fern meadows, ${childName} stumbled upon giant, friendly footprints that led right to a sunny prehistoric riverbank.`,
          prompt: `${charDesc} looking playfully at huge round footprint fossils in a vibrant prehistoric valley filled with lush giant ferns, ${artStyle} artwork.`,
        },
        {
          text: `Peeking through the tall leaves was Barny, a gentle baby Brachiosaurus who loved eating sweet mangoes from the tallest branches.`,
          prompt: `${charDesc} offering a juicy ripe mango to a cute, smiling long-necked baby dinosaur with warm curious eyes, ${artStyle}.`,
        },
        {
          text: `${childName} and Barny played hide-and-seek with a flock of feathered baby Pterodactyls who giggled behind the rainbow waterfalls.`,
          prompt: `${charDesc} sliding down the smooth tail of a friendly green dinosaur into a pile of soft clover, joyful atmosphere, ${artStyle}.`,
        },
        {
          text: `As the volcano puffed friendly heart-shaped clouds of steam into the evening sky, ${childName} gave Barny a big hug. "Best friends forever!"`,
          prompt: `${charDesc} giving a warm hug to the friendly baby dinosaur with a gentle pastel sunset in the background, heartwarming ${artStyle} illustration.`,
        },
        {
          text: `With a baby dino footprint souvenir tucked in their pocket, ${childName} smiled, ready for the next big adventure.`,
          prompt: `${charDesc} standing at the crest of a prehistoric green hill with friendly dinosaurs waving in the valley below, ${artStyle} style.`,
        },
      ],
    },
    magic: {
      title: `${childName} and the Sky Castle of Dragons`,
      moral: 'Sharing joy and understanding brings harmony to every land.',
      pageTemplates: [
        {
          text: `High above the fluffy marshmallow clouds, ${childName} stepped onto the crystal bridges of the magical floating castle.`,
          prompt: `${charDesc} standing on a shimmering translucent crystal bridge leading to a majestic pastel cloud castle, ${artStyle} art.`,
        },
        {
          text: `There, ${childName} met Sparky, a tiny blue baby dragon who sneezed colorful sparkles whenever he got excited!`,
          prompt: `${charDesc} giggling with a cute little blue baby dragon that is sneezing tiny colorful magical starbursts and sparkles, ${artStyle}.`,
        },
        {
          text: `Together, they baked magic cloud-cakes that floated in mid-air and shared them with all the castle sprites and fairies.`,
          prompt: `${charDesc} decorating floating pastel cupcakes with a friendly baby dragon in a whimsical fairytale kitchen, ${artStyle}.`,
        },
        {
          text: `The Dragon Queen presented ${childName} with a golden star ribbon in honor of their great kindness and cheerfulness.`,
          prompt: `${charDesc} being awarded a glowing golden ribbon by a majestic, gentle mother dragon with kind eyes, ${artStyle}.`,
        },
        {
          text: `Riding gently back down on a soft cloud, ${childName} smiled brightly, knowing true magic is born from a generous heart.`,
          prompt: `${charDesc} floating down on a cozy pink cloud toward a cozy village, smiling with starry wonder, ${artStyle} picture book art.`,
        },
      ],
    },
    default: {
      title: `${childName}'s Wonderous Journey of Discovery`,
      moral: 'Every small act of kindness makes the whole world shine brighter.',
      pageTemplates: [
        {
          text: `One bright and sunny morning, ${childName} set out on a special quest to find the fountain of sparkling joy.`,
          prompt: `${charDesc} starting an adventure on a sunny cobblestone path with colorful flowers blooming on all sides, cheerful ${artStyle} illustration.`,
        },
        {
          text: `Along the way, ${childName} helped a confused little squirrel carry acorns across a babbling brook. "Thank you, friend!" chattered the squirrel.`,
          prompt: `${charDesc} helping a cute fluffy squirrel cross wooden stepping stones over a crystal clear stream, ${artStyle}.`,
        },
        {
          text: `Together they discovered a hidden meadow where rainbows touched the ground and colorful butterflies danced to a merry breeze.`,
          prompt: `${charDesc} dancing in a vibrant flower meadow with swirling colorful butterflies and soft rainbow light, ${artStyle}.`,
        },
        {
          text: `${childName} realized that the greatest joy of all was sharing happiness with new friends. What a magical day it had been!`,
          prompt: `${charDesc} sitting happily on a hill under a warm golden sunset with friendly animal companions, smiling warmly, ${artStyle}.`,
        },
        {
          text: `As the evening stars began to twinkle, ${childName} headed home with a cheerful heart, ready for tomorrow's new wonders.`,
          prompt: `${charDesc} walking toward a cozy cottage with glowing windows under a peaceful dusk sky, heartwarming ${artStyle} artwork.`,
        },
      ],
    },
  };

  let chosenTheme = 'default';
  if (themeLower.includes('space') || themeLower.includes('star') || themeLower.includes('galaxy') || themeLower.includes('planet')) {
    chosenTheme = 'space';
  } else if (themeLower.includes('forest') || themeLower.includes('tree') || themeLower.includes('wood') || themeLower.includes('nature') || themeLower.includes('jungle')) {
    chosenTheme = 'forest';
  } else if (themeLower.includes('ocean') || themeLower.includes('sea') || themeLower.includes('water') || themeLower.includes('dolphin') || themeLower.includes('mermaid')) {
    chosenTheme = 'ocean';
  } else if (themeLower.includes('dino') || themeLower.includes('jurassic') || themeLower.includes('prehistoric')) {
    chosenTheme = 'dinosaur';
  } else if (themeLower.includes('dragon') || themeLower.includes('castle') || themeLower.includes('magic') || themeLower.includes('fairy')) {
    chosenTheme = 'magic';
  }

  const baseStory = storiesByTheme[chosenTheme] || storiesByTheme.default;
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    const templateIndex = i % baseStory.pageTemplates.length;
    const baseTemplate = baseStory.pageTemplates[templateIndex];
    
    let pageText = baseTemplate.text;
    let imagePrompt = baseTemplate.prompt;

    if (i >= baseStory.pageTemplates.length) {
      pageText = `As Chapter ${i + 1} continued, ${childName} unlocked even more marvelous secrets in the ${theme}. Every step brought more giggles and wonder.`;
      imagePrompt = `${charDesc} continuing their joyful journey in ${theme}, surrounded by ${artStyle} style artistic details, warm storybook atmosphere.`;
    }

    pages.push({
      text: pageText,
      imagePrompt: imagePrompt,
    });
  }

  return {
    title: baseStory.title,
    moral: baseStory.moral,
    pages: pages,
  };
}

module.exports = {
  CHILD_STORY_SYSTEM_PROMPT,
  generateStoryScript,
};
