const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * Generates a printable PDF from a complete story document
 */
async function generateStoryPDF(story, childProfile) {
  const templatePath = path.join(__dirname, '../templates/pdfBookTemplate.html');
  let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

  const childName = childProfile?.name || 'Adventurer';
  const title = story.title || 'An Enchanted Adventure';
  const coverImageUrl = story.coverImageUrl || story.pages?.[0]?.imageUrl || '';
  const moral = story.moral || 'Kindness, curiosity, and courage light our way.';
  const artStyle = story.artStyle || 'watercolor';
  const theme = story.theme || 'Adventure';
  const totalPages = story.pages?.length || 4;

  // Render pages loop in template
  const pagesBlockRegex = /{{#pages}}([\s\S]*?){{\/pages}}/;
  const match = htmlTemplate.match(pagesBlockRegex);

  if (match) {
    const singlePageTemplate = match[1];
    const renderedPagesHtml = story.pages
      .map((p) => {
        return singlePageTemplate
          .replace(/{{pageNumber}}/g, p.pageNumber)
          .replace(/{{totalPages}}/g, totalPages)
          .replace(/{{imageUrl}}/g, p.imageUrl)
          .replace(/{{text}}/g, p.text);
      })
      .join('\n');

    htmlTemplate = htmlTemplate.replace(pagesBlockRegex, renderedPagesHtml);
  }

  // Replace global variables
  htmlTemplate = htmlTemplate
    .replace(/{{title}}/g, title)
    .replace(/{{childName}}/g, childName)
    .replace(/{{coverImageUrl}}/g, coverImageUrl)
    .replace(/{{moral}}/g, moral)
    .replace(/{{artStyle}}/g, artStyle)
    .replace(/{{theme}}/g, theme);

  let browser;
  try {
    console.log(`[PDFService] Launching Puppeteer for story "${story._id}"...`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    
    // Set viewport to A4 landscape equivalent in pixels
    await page.setViewport({ width: 1122, height: 794, deviceScaleFactor: 2 });

    // Load HTML content
    await page.setContent(htmlTemplate, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 30000,
    });

    // Generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    });

    console.log(`[PDFService] Successfully generated PDF (${pdfBuffer.length} bytes)`);
    return pdfBuffer;
  } catch (error) {
    console.error('[PDFService Error] Failed to generate PDF:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generateStoryPDF,
};
