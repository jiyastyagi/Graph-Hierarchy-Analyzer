const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const USER_ID = process.env.USER_ID || "jiyatyagi_20060731";
const EMAIL_ID = process.env.EMAIL_ID || "jiya.tyagi.btech2023@sitpune.edu.in";
const ENROLLMENT_NUMBER = process.env.ENROLLMENT_NUMBER || "23070122111";

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: "Invalid JSON format in request body",
      user_id: USER_ID,
      email_id: EMAIL_ID,
      enrollment_number: ENROLLMENT_NUMBER,
      hierarchies: [],
      invalid_entries: ["Invalid JSON format"],
      duplicate_edges: [],
      summary: {
        total_trees: 0,
        total_cycles: 0,
        largest_tree_root: ""
      }
    });
  }
  next();
});

app.post('/api/graph', (req, res) => {
  try {
    const { edges } = req.body;

    if (!edges || !Array.isArray(edges)) {
      return res.status(400).json({
        error: "Missing or invalid 'edges' parameter. It must be a JSON array of strings.",
        user_id: USER_ID,
        email_id: EMAIL_ID,
        enrollment_number: ENROLLMENT_NUMBER,
        hierarchies: [],
        invalid_entries: edges === undefined ? ["Missing edges"] : ["Invalid edges format"],
        duplicate_edges: [],
        summary: { total_trees: 0, total_cycles: 0, largest_tree_root: "" }
      });
    }

    const invalid_entries = [];
    const duplicate_edges = [];
    const seenEdges = new Set();
    const activeEdges = [];
    const parentOf = new Map();
    const childrenOf = new Map();
    const allNodes = new Set();

    const registerNode = (node) => {
      allNodes.add(node);
      if (!childrenOf.has(node)) {
        childrenOf.set(node, []);
      }
    };

    for (const entry of edges) {
      if (typeof entry !== 'string') {
        invalid_entries.push(String(entry));
        continue;
      }

      const trimmed = entry.trim();
      const match = trimmed.match(/^([A-Z])->([A-Z])$/);

      if (!match) {
        invalid_entries.push(entry);
        continue;
      }

      const parent = match[1];
      const child = match[2];

      if (parent === child) {
        invalid_entries.push(entry);
        continue;
      }

      const edgeString = `${parent}->${child}`;

      if (seenEdges.has(edgeString)) {
        if (!duplicate_edges.includes(edgeString)) {
          duplicate_edges.push(edgeString);
        }
        continue;
      }
      seenEdges.add(edgeString);

      if (parentOf.has(child)) {
        continue;
      }

      parentOf.set(child, parent);
      registerNode(parent);
      registerNode(child);
      activeEdges.push({ parent, child });
    }

    for (const { parent, child } of activeEdges) {
      childrenOf.get(parent).push(child);
    }

    const adj = new Map();
    for (const node of allNodes) {
      adj.set(node, []);
    }
    for (const { parent, child } of activeEdges) {
      adj.get(parent).push(child);
      adj.get(child).push(parent);
    }

    const visited = new Set();
    const components = [];

    const getComponentNodes = (start) => {
      const component = [];
      const queue = [start];
      visited.add(start);

      while (queue.length > 0) {
        const curr = queue.shift();
        component.push(curr);
        const neighbors = adj.get(curr) || [];
        for (const nextNode of neighbors) {
          if (!visited.has(nextNode)) {
            visited.add(nextNode);
            queue.push(nextNode);
          }
        }
      }
      return component;
    };

    for (const { parent, child } of activeEdges) {
      if (!visited.has(parent)) {
        components.push(getComponentNodes(parent));
      }
      if (!visited.has(child)) {
        components.push(getComponentNodes(child));
      }
    }

    const hierarchies = [];
    let total_trees = 0;
    let total_cycles = 0;
    let maxDepth = -1;
    let largest_tree_root = "";

    const buildSubtree = (node) => {
      const children = childrenOf.get(node) || [];
      const sortedChildren = [...children].sort();
      
      const treeObj = {};
      let childMaxDepth = 0;

      for (const child of sortedChildren) {
        const result = buildSubtree(child);
        treeObj[child] = result.tree;
        if (result.depth > childMaxDepth) {
          childMaxDepth = result.depth;
        }
      }

      return {
        tree: treeObj,
        depth: 1 + childMaxDepth
      };
    };

    for (const component of components) {
      const roots = component.filter(node => !parentOf.has(node));

      if (roots.length === 1) {
        const root = roots[0];
        const { tree, depth } = buildSubtree(root);

        hierarchies.push({
          root,
          tree: { [root]: tree },
          depth
        });
        total_trees++;

        if (depth > maxDepth) {
          maxDepth = depth;
          largest_tree_root = root;
        } else if (depth === maxDepth) {
          if (!largest_tree_root || root < largest_tree_root) {
            largest_tree_root = root;
          }
        }
      } else if (roots.length === 0) {
        const root = [...component].sort()[0];
        hierarchies.push({
          root,
          tree: {},
          has_cycle: true
        });
        total_cycles++;
      } else {
        const root = roots.sort()[0];
        const { tree, depth } = buildSubtree(root);
        hierarchies.push({
          root,
          tree: { [root]: tree },
          depth
        });
        total_trees++;
      }
    }

    return res.json({
      user_id: USER_ID,
      email_id: EMAIL_ID,
      enrollment_number: ENROLLMENT_NUMBER,
      hierarchies,
      invalid_entries,
      duplicate_edges,
      summary: {
        total_trees,
        total_cycles,
        largest_tree_root
      }
    });

  } catch (error) {
    return res.status(500).json({ error: "Server error occurred: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
