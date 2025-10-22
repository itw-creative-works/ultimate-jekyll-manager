// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('blogify');
const jetpack = require('fs-jetpack');
const path = require('path');
const fetch = require('wonderful-fetch');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

// Random word lists for generating descriptions and titles
const adjectives = ['innovative', 'creative', 'dynamic', 'strategic', 'powerful', 'effective', 'modern', 'agile', 'sustainable', 'revolutionary', 'transformative', 'cutting-edge', 'comprehensive', 'robust', 'scalable', 'essential', 'advanced', 'proven', 'emerging', 'vital'];
const nouns = ['solutions', 'strategies', 'insights', 'approaches', 'methodologies', 'frameworks', 'concepts', 'principles', 'techniques', 'innovations', 'perspectives', 'opportunities', 'challenges', 'developments', 'trends', 'practices', 'methods', 'systems', 'models', 'patterns'];
const verbs = ['enhance', 'optimize', 'transform', 'revolutionize', 'streamline', 'accelerate', 'empower', 'facilitate', 'leverage', 'maximize', 'drive', 'deliver', 'achieve', 'unlock', 'enable', 'boost', 'advance', 'improve', 'elevate', 'cultivate'];
const titleWords = ['guide', 'tips', 'secrets', 'essentials', 'masterclass', 'blueprint', 'roadmap', 'playbook', 'handbook', 'tutorial', 'lessons', 'wisdom', 'analysis', 'review', 'overview', 'exploration', 'journey', 'adventure', 'discovery', 'revelation'];

// Content generation arrays
const topics = ['business', 'technology', 'marketing', 'productivity', 'growth', 'innovation', 'strategy', 'leadership', 'development', 'trends', 'digital transformation', 'customer experience', 'data analytics', 'automation', 'sustainability'];
const h2Starters = ['Understanding', 'Exploring', 'Implementing', 'Maximizing', 'Building', 'Creating', 'Developing', 'Optimizing', 'Leveraging', 'Transforming', 'Achieving', 'Mastering'];

// Blog categories (5 possible categories)
const blogCategories = ['Technology', 'Business', 'Marketing', 'Innovation', 'Strategy'];

// Unsplash image IDs for consistent test images
const unsplashImages = [
  'photo-1556742049-0cfed4f6a45d', // business meeting
  'photo-1551434678-e076c223a692', // office workspace
  'photo-1556745757-8d76bdb6984b', // analytics dashboard
  'photo-1553484771-371a605b060b', // teamwork
  'photo-1556761175-4b46a572b786', // collaboration
  'photo-1556742044-3c52d6e88c62', // presentation
  'photo-1551651056-dbac26032b5', // modern office
  'photo-1556742031-c6961e8560b0', // laptop work
  'photo-1553877522-43269d4ea984', // strategy planning
  'photo-1556742393-d75f468bfcb0', // meeting room
  'photo-1554200876-56c2f25224fa', // data visualization
  'photo-1551288049-bebda4e38f71', // charts and graphs
];

// Image width options for variety
const imageWidths = [800, 1024, 1200];

const paragraphStarters = [
  'In today\'s rapidly evolving business landscape,',
  'Organizations worldwide are discovering that',
  'Research has consistently shown that',
  'Industry leaders understand that',
  'The key to success lies in',
  'Modern businesses are increasingly focused on',
  'Recent developments have highlighted the importance of',
  'Companies that embrace',
  'The most successful organizations',
  'As we move forward,'
];

function getRandomWords(count) {
  const words = [];
  const allWords = [...adjectives, ...nouns, ...verbs];

  for (let i = 0; i < count; i++) {
    words.push(allWords[Math.floor(Math.random() * allWords.length)]);
  }

  return words.join(' ');
}

function generateTitleSuffix() {
  // Generate 3-7 random words for title
  const wordCount = 3 + Math.floor(Math.random() * 5); // 3-7 words
  const words = [];

  // Mix different types of words for more natural titles
  for (let i = 0; i < wordCount; i++) {
    let word;
    const choice = Math.random();

    if (choice < 0.25) {
      word = getRandomElement(adjectives);
    } else if (choice < 0.5) {
      word = getRandomElement(nouns);
    } else if (choice < 0.7) {
      word = getRandomElement(verbs);
    } else if (choice < 0.85) {
      word = getRandomElement(titleWords);
    } else {
      word = getRandomElement(topics);
    }

    words.push(word);
  }

  // Capitalize first word
  if (words.length > 0) {
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }

  return words.join(' ');
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate random categories (1-3 from the 5 available)
function getRandomCategories() {
  // Determine how many categories (1-3)
  const numCategories = 1 + Math.floor(Math.random() * 3);

  // Copy array to avoid modifying original
  const availableCategories = [...blogCategories];
  const selectedCategories = [];

  // Select random categories without duplicates
  for (let i = 0; i < numCategories && availableCategories.length > 0; i++) {
    const index = Math.floor(Math.random() * availableCategories.length);
    selectedCategories.push(availableCategories[index]);
    availableCategories.splice(index, 1); // Remove selected to avoid duplicates
  }

  return selectedCategories;
}

// Download image from URL using wonderful-fetch
async function downloadImage(url, filepath) {
  try {
    await fetch(url, {
      download: filepath,
      timeout: 30000, // 30 second timeout
      tries: 2 // Retry once if it fails
    });
  } catch (err) {
    // Clean up partial file if exists
    jetpack.remove(filepath);
    throw err;
  }
}

// Generate images for a blog post
async function generatePostImages(postId, titleSuffix) {
  const imagesDir = path.join('src', 'assets', 'images', 'blog', `post-${postId}`);

  // Create directory
  jetpack.dir(imagesDir);

  // Determine how many images to generate (3-6)
  const imageCount = 3 + Math.floor(Math.random() * 4);
  const downloadedImages = [];

  // Generate main featured image with title-based filename
  const mainImageName = titleSuffix.toLowerCase().replace(/\s+/g, '-');
  const mainImageWidth = getRandomElement(imageWidths);
  const mainImageId = getRandomElement(unsplashImages);
  const mainImageUrl = `https://images.unsplash.com/${mainImageId}?w=${mainImageWidth}&q=80`;
  const mainImagePath = path.join(imagesDir, `${mainImageName}.jpg`);

  try {
    await downloadImage(mainImageUrl, mainImagePath);
    downloadedImages.push({
      path: `/assets/images/blog/post-${postId}/${mainImageName}.jpg`,
      alt: `${titleSuffix} featured image`,
      isFeatured: true
    });
    logger.log(`  Downloaded featured image: ${mainImageName}.jpg`);
  } catch (err) {
    logger.warn(`  Failed to download featured image: ${err.message}`);
  }

  // Generate additional images with random names
  for (let i = 1; i < imageCount; i++) {
    const randomName = getRandomWords(2 + Math.floor(Math.random() * 3)).toLowerCase().replace(/\s+/g, '-');
    const imageWidth = getRandomElement(imageWidths);
    const imageId = getRandomElement(unsplashImages);
    const imageUrl = `https://images.unsplash.com/${imageId}?w=${imageWidth}&q=80`;
    const imagePath = path.join(imagesDir, `${randomName}.jpg`);

    try {
      await downloadImage(imageUrl, imagePath);
      downloadedImages.push({
        path: `/assets/images/blog/post-${postId}/${randomName}.jpg`,
        alt: `${randomName.replace(/-/g, ' ')} image`
      });
      logger.log(`  Downloaded image ${i}: ${randomName}.jpg`);
    } catch (err) {
      logger.warn(`  Failed to download image ${i}: ${err.message}`);
    }
  }

  return downloadedImages;
}

function generateParagraph() {
  const starter = getRandomElement(paragraphStarters);
  const topic = getRandomElement(topics);
  const adjective = getRandomElement(adjectives);
  const noun = getRandomElement(nouns);
  const verb = getRandomElement(verbs);

  const sentences = [
    `${starter} ${adjective} ${noun} play a crucial role in driving success.`,
    `This approach helps organizations ${verb} their potential and achieve measurable results.`,
    `By focusing on ${topic}, companies can build sustainable competitive advantages.`,
    `The integration of these principles creates opportunities for long-term growth and innovation.`
  ];

  return sentences.join(' ');
}

function generateBlogContent(images) {
  const numSections = 3 + Math.floor(Math.random() * 3); // 3-5 sections
  let content = '';
  let imageIndex = 0;

  // Generate intro paragraph
  content += generateParagraph() + '\n\n';

  // Use all images (including featured) for content placement
  const contentImages = [...images];

  // Generate H2 sections with content
  for (let i = 0; i < numSections; i++) {
    const h2Title = `${getRandomElement(h2Starters)} ${getRandomElement(topics)}`;
    content += `## ${h2Title}\n\n`;

    // Add 2-3 paragraphs per section
    const numParagraphs = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < numParagraphs; j++) {
      content += generateParagraph() + '\n\n';
    }

    // Add local image every other section if we have images left
    if (i % 2 === 1 && imageIndex < contentImages.length) {
      const image = contentImages[imageIndex];
      content += `![${image.alt}](${image.path})\n\n`;
      imageIndex++;
    }
  }

  // Add ONE external Unsplash image somewhere in the middle or near the end
  const externalImageId = getRandomElement(unsplashImages);
  const externalImageWidth = getRandomElement(imageWidths);
  const externalImageUrl = `https://images.unsplash.com/${externalImageId}?w=${externalImageWidth}&q=80`;
  const externalAlt = `${getRandomElement(adjectives)} ${getRandomElement(nouns)} illustration`;
  content += `\n![${externalAlt}](${externalImageUrl})\n\n`;

  // Generate conclusion
  content += '## Conclusion\n\n';
  content += generateParagraph();

  return content;
}

module.exports = async function (options) {
  // Log
  logger.log(`Starting blogify...`);

  // Get project root
  const projectRoot = path.resolve(process.cwd());
  const postsDir = path.join(projectRoot, 'src', '_posts', 'test');
  const blogImagesDir = path.join(projectRoot, 'src', 'assets', 'images', 'blog');

  // Clear the test posts directory first (this will also ensure it exists)
  logger.log(`Clearing existing posts in ${postsDir}...`);
  jetpack.dir(postsDir, { empty: true });

  // Clear old blog test image directories (post-test-* directories)
  logger.log(`Clearing old blog test images...`);
  if (jetpack.exists(blogImagesDir)) {
    const items = jetpack.list(blogImagesDir) || [];
    items.forEach(item => {
      if (item.startsWith('post-test-')) {
        const itemPath = path.join(blogImagesDir, item);
        jetpack.remove(itemPath);
        logger.log(`  Removed: ${item}`);
      }
    });
  }

  // Generate 12 posts
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400;

  for (let i = 0; i < 12; i++) {
    // Calculate timestamp for each post (spread over last 12 days)
    const postTimestamp = now - (i * dayInSeconds);
    const postId = `test-${postTimestamp}`; // Add test- prefix to ID
    const postDate = new Date(postTimestamp * 1000);

    // Format date components
    const year = postDate.getFullYear();
    const month = String(postDate.getMonth() + 1).padStart(2, '0');
    const day = String(postDate.getDate()).padStart(2, '0');

    // Generate random title suffix (3-7 words)
    const titleSuffix = generateTitleSuffix();

    // Generate random description
    const wordCount = 10 + Math.floor(Math.random() * 11); // 10-20 words
    const randomWords = getRandomWords(wordCount);

    // Generate random categories (1-3 from 5 possible)
    const postCategories = getRandomCategories();

    // Create filename using title suffix (convert to lowercase and replace spaces with hyphens)
    const filenameSuffix = titleSuffix.toLowerCase().replace(/\s+/g, '-');
    const filename = `${year}-${month}-${day}-${filenameSuffix}.md`;
    const filePath = path.join(postsDir, filename);

    // Download images for this post
    logger.log(`Downloading images for post ${postId}...`);
    const postImages = await generatePostImages(postId, titleSuffix);

    // Get featured image path for frontmatter
    const featuredImage = postImages.find(img => img.isFeatured);

    // Create post content
    const content = `---
### ALL PAGES ###
layout: blueprint/blog/post

### POST ONLY ###
post:
  title: "Post #${i + 1} ${postId} ${titleSuffix}"
  description: "Post ${postId} ${randomWords}"
  author: "alex"
  id: ${postId}
  tags: ["business marketing"]
  categories: ${JSON.stringify(postCategories)}
---

${generateBlogContent(postImages)}`;

    // Write the file
    jetpack.write(filePath, content);
    logger.log(`Created post: ${filename}`);
  }

  logger.log(`Successfully created 12 blog posts in ${postsDir}`);
};
