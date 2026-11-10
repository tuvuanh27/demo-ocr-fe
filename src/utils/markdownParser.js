/**
 * Parses markdown into structured Datalab-style visual blocks
 * for the "Blocks" tab view.
 */
export function parseMarkdownToBlocks(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];

  const lines = markdown.split('\n');
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        id: `blk_${blocks.length + 1}`,
        category: 'SECTIONHEADER',
        color: '#E91E63',
        text: trimmed.replace(/^#+\s*/, ''),
      };
      blocks.push(currentBlock);
      currentBlock = null;
    } else if (trimmed.startsWith('|')) {
      if (currentBlock && currentBlock.category === 'TABLE') {
        currentBlock.text += '\n' + line;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          id: `blk_${blocks.length + 1}`,
          category: 'TABLE',
          color: '#3F51B5',
          text: line,
        };
      }
    } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
      if (currentBlock && currentBlock.category === 'LISTGROUP') {
        currentBlock.text += '\n' + line;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          id: `blk_${blocks.length + 1}`,
          category: 'LISTGROUP',
          color: '#00BFA5',
          text: line,
        };
      }
    } else {
      if (currentBlock && currentBlock.category === 'PARAGRAPH') {
        currentBlock.text += '\n' + line;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          id: `blk_${blocks.length + 1}`,
          category: 'PARAGRAPH',
          color: '#1976D2',
          text: line,
        };
      }
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

