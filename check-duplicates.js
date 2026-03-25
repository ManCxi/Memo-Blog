const { Attachment } = require('./models');

async function check() {
  const atts = await Attachment.findAll();
  console.log(`Total attachments: ${atts.length}`);
  const paths = new Map();
  for (const a of atts) {
    if (paths.has(a.path)) {
      paths.get(a.path).push(a.id);
    } else {
      paths.set(a.path, [a.id]);
    }
  }
  
  for (const [path, ids] of paths.entries()) {
    if (ids.length > 1) {
      console.log(`Duplicate path: ${path} (IDs: ${ids.join(', ')})`);
    }
  }
  process.exit(0);
}

check();
