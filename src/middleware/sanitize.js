/**
 * Sanitizes story generation inputs, specifically customDetails.
 * Removes instruction-override attempts, prompt injections, harmful keywords,
 * and caps length to ensure safe input to Claude.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /you\s+are\s+now\s+/gi,
  /system\s*prompt/gi,
  /system\s*override/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /developer\s+mode/gi,
  /new\s+rule/gi,
  /bypass\s+filter/gi,
  /act\s+as\s+an\s+unfiltered/gi,
  /output\s+only\s+raw/gi,
  /do\s+not\s+follow/gi,
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<[\s\S]*?>/g, // HTML tags
];

const UNSAFE_KEYWORDS = [
  /\b(gun|guns|knife|knives|sword|kill|killed|murder|blood|bloody|gore|bullet|shoot|weapon|poison|die|death|corpse|suicide|hang|drown|burn\s+alive|strangle|torture|drug|drugs|alcohol|beer|wine|whiskey|cigarette|vape|terrorist|bomb|explosive|war|nuke)\b/gi,
  /\b(sexy|naked|nude|kissing|porn|erotic|boob|breast|butt|ass|penis|vagina|sensual|romance|dating)\b/gi,
  /\b(hate|racist|slur|nazi|curse|damn|hell|bitch|bastard|fuck|shit|crap)\b/gi,
];

const SAFE_FALLBACK_DETAILS = [
  'The child discovers a glowing friendly firefly that loves sharing cookies.',
  'A cheerful little puppy with floppy ears joins the journey to find a hidden rainbow.',
  'A tiny blue bird teaches a delightful tune that brings smiles to everyone in the village.',
  'The child finds a magical sparkly stone that shines softly when someone is kind.',
];

/**
 * Sanitizes input string
 * @param {string} input 
 * @returns {{ sanitized: string, wasSanitized: boolean, wasReplaced: boolean }}
 */
function sanitizeCustomDetails(input) {
  if (!input || typeof input !== 'string') {
    return { sanitized: '', wasSanitized: false, wasReplaced: false };
  }

  // 1. Cap length to 300 characters
  let clean = input.slice(0, 300).trim();

  // 2. Check for unsafe keywords (inappropriate themes for children)
  let foundUnsafe = false;
  for (const pattern of UNSAFE_KEYWORDS) {
    if (pattern.test(clean)) {
      foundUnsafe = true;
      break;
    }
  }

  if (foundUnsafe) {
    // Safely substitute with wholesome default
    const fallback = SAFE_FALLBACK_DETAILS[Math.floor(Math.random() * SAFE_FALLBACK_DETAILS.length)];
    return {
      sanitized: fallback,
      wasSanitized: true,
      wasReplaced: true,
    };
  }

  // 3. Strip prompt injection patterns
  let hadInjection = false;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      clean = clean.replace(pattern, ' ');
      hadInjection = true;
    }
  }

  // 4. Normalize whitespaces and clean residual punctuation
  clean = clean.replace(/\s+/g, ' ').trim();

  // If the prompt injection stripping emptied the string or made it nonsensical
  if (hadInjection && clean.length < 5) {
    const fallback = SAFE_FALLBACK_DETAILS[0];
    return {
      sanitized: fallback,
      wasSanitized: true,
      wasReplaced: true,
    };
  }

  return {
    sanitized: clean,
    wasSanitized: hadInjection,
    wasReplaced: false,
  };
}

// Express middleware for story creation
const sanitizeStoryInput = (req, res, next) => {
  if (req.body && req.body.customDetails) {
    const result = sanitizeCustomDetails(req.body.customDetails);
    req.body.customDetails = result.sanitized;
    req.body._sanitizationInfo = result;
  }
  next();
};

module.exports = {
  sanitizeCustomDetails,
  sanitizeStoryInput,
};
