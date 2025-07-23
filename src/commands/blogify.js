// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('blogify');
const jetpack = require('fs-jetpack');
const path = require('path');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

// Random word lists for generating descriptions
const adjectives = ['innovative', 'creative', 'dynamic', 'strategic', 'powerful', 'effective', 'modern', 'agile', 'sustainable', 'revolutionary', 'transformative', 'cutting-edge', 'comprehensive', 'robust', 'scalable'];
const nouns = ['solutions', 'strategies', 'insights', 'approaches', 'methodologies', 'frameworks', 'concepts', 'principles', 'techniques', 'innovations', 'perspectives', 'opportunities', 'challenges', 'developments', 'trends'];
const verbs = ['enhance', 'optimize', 'transform', 'revolutionize', 'streamline', 'accelerate', 'empower', 'facilitate', 'leverage', 'maximize', 'drive', 'deliver', 'achieve', 'unlock', 'enable'];

// Content generation arrays
const topics = ['business', 'technology', 'marketing', 'productivity', 'growth', 'innovation', 'strategy', 'leadership', 'development', 'trends', 'digital transformation', 'customer experience', 'data analytics', 'automation', 'sustainability'];
const h2Starters = ['Understanding', 'Exploring', 'Implementing', 'Maximizing', 'Building', 'Creating', 'Developing', 'Optimizing', 'Leveraging', 'Transforming', 'Achieving', 'Mastering'];
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

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
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

function generateBlogContent() {
  const numSections = 3 + Math.floor(Math.random() * 3); // 3-5 sections
  let content = '';
  
  // Generate intro paragraph
  content += generateParagraph() + '\n\n';
  
  // Generate H2 sections with content
  for (let i = 0; i < numSections; i++) {
    const h2Title = `${getRandomElement(h2Starters)} ${getRandomElement(topics)}`;
    content += `## ${h2Title}\n\n`;
    
    // Add 2-3 paragraphs per section
    const numParagraphs = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < numParagraphs; j++) {
      content += generateParagraph() + '\n\n';
    }
    
    // Add image every other section
    if (i % 2 === 1) {
      content += `![${getRandomElement(topics)} image](https://images.unsplash.com/photo-1752867494500-9ea9322f58c9?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)\n\n`;
    }
  }
  
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
  
  // Clear the test directory first (this will also ensure it exists)
  logger.log(`Clearing existing posts in ${postsDir}...`);
  jetpack.dir(postsDir, { empty: true });
  
  // Generate 12 posts
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400;
  
  for (let i = 0; i < 12; i++) {
    // Calculate timestamp for each post (spread over last 12 days)
    const postTimestamp = now - (i * dayInSeconds);
    const postDate = new Date(postTimestamp * 1000);
    
    // Format date components
    const year = postDate.getFullYear();
    const month = String(postDate.getMonth() + 1).padStart(2, '0');
    const day = String(postDate.getDate()).padStart(2, '0');
    
    // Generate random description
    const wordCount = 10 + Math.floor(Math.random() * 11); // 10-20 words
    const randomWords = getRandomWords(wordCount);
    
    // Create filename
    const filename = `${year}-${month}-${day}-post-${postTimestamp}.md`;
    const filePath = path.join(postsDir, filename);
    
    // Create post content
    const content = `---
### ALL PAGES ###
layout: blueprint/blog/post

### POST ONLY ###
post:
  title: "Post ${postTimestamp}"
  description: "Post ${postTimestamp} ${randomWords}"
  author: "alex"
  id: ${postTimestamp}
  tags: ["business marketing"]
  categories: ["Marketing", "Business"]
---

${generateBlogContent()}`;
    
    // Write the file
    jetpack.write(filePath, content);
    logger.log(`Created post: ${filename}`);
  }
  
  logger.log(`Successfully created 12 blog posts in ${postsDir}`);
};