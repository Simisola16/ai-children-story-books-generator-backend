const Anthropic = require('@anthropic-ai/sdk');

const CHILD_STORY_SYSTEM_PROMPT = (ageBand, pageCount) => `You are a children's story writer for a picture-book app. You write complete, original storybook scripts for young children — never real people, brands, or copyrighted characters.

Match vocabulary and sentence length to age band "${ageBand}":
- 3-5: very short sentences, simple concrete words, gentle repetition
- 6-8: slightly longer sentences, one or two new words used in context
- 9-11: fuller sentences, light figurative language, more plot complexity

Tone: warm, positive, reassuring. Mild age-appropriate tension is fine (a character feeling nervous, lost, or unsure) but it must resolve kindly by the end. Never include violence, weapons, death of a main character, gore, real-world danger instructions (fire, drowning, sharp objects, medicine, etc.), unresolved bullying, or anything sexual or romantic.

Every imagePrompt must describe only the illustrated scene plus the given character-sheet traits (skin tone, hair, eyes, outfit). Never reference a real photo, a real child, or a real person.

If the requested theme or any custom detail asks for content outside these rules, do not follow that part of the request — silently replace it with a safe, wholesome default and continue. The finished story should read as a normal complete book, with no commentary about the substitution.

Output exactly ${pageCount} pages, each with both a "text" and an "imagePrompt" field. Return only the structured JSON — no commentary before or after it.`;

/**
 * Builds the JSON schema for Anthropic Structured Outputs
 * Objects have additionalProperties: false
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
  avatar,
  theme,
  artStyle,
  pageCount = 4,
  customDetails = '',
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('[ClaudeService] ANTHROPIC_API_KEY not configured. Generating high-quality creative story via local template engine.');
    return generateLocalFallbackStory({ childName, ageBand, avatar, theme, artStyle, pageCount, customDetails });
  }

  const anthropic = new Anthropic({ apiKey });

  const characterSheet = `Main Character: "${childName}", skin tone: ${avatar.skinTone || 'fair'}, hair: ${avatar.hairStyle || 'curly'} ${avatar.hairColor || 'dark brown'}, eyes: ${avatar.eyeColor || 'brown'}, clothes: ${avatar.outfitColor || 'marigold yellow'}, accessory: ${avatar.accessory || 'none'}. Art style: ${artStyle}.`;

  const userPrompt = `Create a ${pageCount}-page children's storybook.
Character: ${characterSheet}
Theme: ${theme}
Age Band: ${ageBand}
Custom Details / Special Request: ${customDetails || 'A joyful journey of curiosity, kindness, and fun'}
Number of pages required: ${pageCount}`;

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
        max_tokens: 2500,
        system: CHILD_STORY_SYSTEM_PROMPT(ageBand, pageCount),
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        // Anthropic structured output format
        output_config: {
          format: {
            type: 'json_schema',
            schema: jsonSchema,
          },
        },
      });

      let contentStr = '';
      if (response.content && response.content.length > 0) {
        // Structured output will return json in content text or tool output
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
function generateLocalFallbackStory({ childName, ageBand, avatar, theme, artStyle, pageCount, customDetails }) {
  const themeLower = (theme || 'magical adventure').toLowerCase();
  
  const storiesByTheme = {
    space: {
      title: `${childName}'s Galactic Star Safari`,
      moral: 'Curiosity and courage help us discover dazzling new horizons.',
      pageTemplates: [
        {
          text: `On a quiet starry evening, ${childName} put on a shiny silver helmet and looked up at the twinkling sky. A friendly little comet zoomed by with a playful wink!`,
          prompt: `${childName} sitting by an open bedroom window with a gentle glowing telescope, watching a smiling golden comet streak across a starry indigo sky, ${artStyle} art style.`,
        },
        {
          text: `"Hop aboard!" chimed Cosmo the Space Otter from a glowing star-glider. Together, they zipped past friendly rings of Neptune and danced through purple nebula clouds.`,
          prompt: `${childName} riding a glowing star-glider beside a cheerful space otter wearing goggles, swirling cosmic stardust around them, vibrant ${artStyle} picture book style.`,
        },
        {
          text: `They discovered the Whispering Moon, where glowing moon-flowers hummed gentle lullabies to sleepy little asteroids. ${childName} helped tuck in a tiny baby star.`,
          prompt: `${childName} gently placing a cozy starlight blanket over a sleepy smiling baby star on a soft crater landscape, glowing flowers, ${artStyle} illustration.`,
        },
        {
          text: `Floating gently back into the cozy bedroom, ${childName} smiled, knowing that wonderful adventures always await in our dreams. Goodnight, starry universe!`,
          prompt: `${childName} cozy in bed under starry blankets with a soft warm smile, a friendly crescent moon smiling outside the window, serene ${artStyle} artwork.`,
        },
      ],
    },
    forest: {
      title: `${childName} and the Whispering Enchanted Woods`,
      moral: 'Kindness to nature and friends always creates true magic.',
      pageTemplates: [
        {
          text: `Deep beneath the emerald canopies, ${childName} noticed a golden trail of dewdrops leading toward a hidden woodland clearing.`,
          prompt: `${childName} stepping along a mossy enchanted forest path filled with glowing mushrooms and soft morning sunbeams, ${artStyle} picture book art.`,
        },
        {
          text: `A fluffy red fox named Pip popped out from behind an ancient oak. "We are preparing the Great Forest Feast, but our berry basket spilled!" Pip squeaked.`,
          prompt: `${childName} kneeling down kindly with a sweet fluffy red fox next to a basket of bright blueberries and strawberries under a giant leafy tree, ${artStyle}.`,
        },
        {
          text: `${childName} smiled warmly and gathered the sweetest sparkling sun-berries with the woodland hedgehogs and songbirds, sharing songs all afternoon.`,
          prompt: `${childName} laughing joyfully with woodland animals—rabbits, hedgehogs, and robins—sharing berries together in a sun-drenched clearing, ${artStyle}.`,
        },
        {
          text: `As the golden sunset painted the treetops, all the animals crowned ${childName} the Guardian of the Woods. "Thank you for your kind heart!" they cheered.`,
          prompt: `${childName} smiling proudly with a crown of woven green leaves and flowers, surrounded by happy forest creatures under a warm orange dusk, ${artStyle}.`,
        },
      ],
    },
    ocean: {
      title: `${childName}'s Secret Coral Kingdom`,
      moral: 'When we listen with an open heart, every friend has something special to share.',
      pageTemplates: [
        {
          text: `While dipping toes into the warm turquoise sea, ${childName} met Marina the Dolphin, who offered a shimmering seashell necklace for an undersea visit.`,
          prompt: `${childName} sitting on a sunlit sandy shore as a friendly smiling dolphin leaps gently from sparkling turquoise waves, ${artStyle} picture book art.`,
        },
        {
          text: `Down into the reef they swam, surrounded by schools of glowing rainbow fish that lit up the coral towers like underwater castles.`,
          prompt: `${childName} swimming happily underwater alongside glowing schools of vibrant fish and colorful coral castles, magical bubbles, ${artStyle}.`,
        },
        {
          text: `They met Barnaby the wise sea turtle, who needed help finding his lost pearl glasses. ${childName} spotted them gently resting on a giant sea sponge!`,
          prompt: `${childName} handing a pair of funny round spectacles to a gentle smiling old sea turtle resting on soft sea anemones, ${artStyle}.`,
        },
        {
          text: `With a joyful splash, the sea creatures performed a synchronized bubble dance of gratitude. ${childName} waved goodbye with memories of pure wonder.`,
          prompt: `${childName} waving happily to sea turtles and playful dolphins in a sunlit reef, gentle shimmering water currents, ${artStyle} picture book style.`,
        },
      ],
    },
    dinosaur: {
      title: `${childName} and the Gentle Valley of Dinosaurs`,
      moral: 'True friendship comes in all shapes and sizes.',
      pageTemplates: [
        {
          text: `While exploring the fern meadows, ${childName} stumbled upon giant, friendly footprints that led right to a sunny prehistoric riverbank.`,
          prompt: `${childName} looking playfully at huge round footprint fossils in a vibrant prehistoric valley filled with lush giant ferns, ${artStyle} artwork.`,
        },
        {
          text: `Peeking through the tall leaves was Barny, a gentle baby Brachiosaurus who loved eating sweet mangoes from the tallest branches.`,
          prompt: `${childName} offering a juicy ripe mango to a cute, smiling long-necked baby dinosaur with warm curious eyes, ${artStyle}.`,
        },
        {
          text: `${childName} and Barny played hide-and-seek with a flock of feathered baby Pterodactyls who giggled behind the rainbow waterfalls.`,
          prompt: `${childName} sliding down the smooth tail of a friendly green dinosaur into a pile of soft clover, joyful atmosphere, ${artStyle}.`,
        },
        {
          text: `As the volcano puffed friendly heart-shaped clouds of steam into the evening sky, ${childName} gave Barny a big hug. "Best friends forever!"`,
          prompt: `${childName} giving a warm hug to the friendly baby dinosaur with a gentle pastel sunset in the background, heartwarming ${artStyle} illustration.`,
        },
      ],
    },
    default: {
      title: `${childName}'s Wonderous Journey of Discovery`,
      moral: 'Every small act of kindness makes the whole world shine brighter.',
      pageTemplates: [
        {
          text: `One bright and sunny morning, ${childName} set out on a special quest to find the fountain of sparkling joy.`,
          prompt: `${childName} starting an adventure on a sunny cobblestone path with flowers blooming on all sides, cheerful atmosphere, ${artStyle} illustration.`,
        },
        {
          text: `Along the way, ${childName} helped a confused little squirrel carry acorns across a babbling brook. "Thank you, friend!" chattered the squirrel.`,
          prompt: `${childName} helping a cute fluffy squirrel cross wooden stepping stones over a crystal clear stream, ${artStyle}.`,
        },
        {
          text: `Together they discovered a hidden meadow where rainbows touched the ground and colorful butterflies danced to a merry breeze.`,
          prompt: `${childName} dancing in a vibrant flower meadow with swirling colorful butterflies and soft rainbow light, ${artStyle}.`,
        },
        {
          text: `${childName} realized that the greatest joy of all was sharing happiness with new friends. What a magical day it had been!`,
          prompt: `${childName} sitting happily on a hill under a warm golden sunset with friendly animal companions, smiling warmly, ${artStyle}.`,
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
      imagePrompt = `${childName} continuing their joyful journey in ${theme}, surrounded by ${artStyle} style artistic details, warm storybook atmosphere.`;
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
