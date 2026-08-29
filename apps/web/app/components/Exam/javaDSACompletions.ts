/**
 * Java DSA Snippet Provider - registered once into Monaco.
 *
 * Covers the most common patterns for DSA exams:
 *   Scanner input, arrays, ArrayList, LinkedList, Stack, Queue,
 *   HashMap, TreeMap, PriorityQueue (min/max heap), Sorting,
 *   Binary Search, common loop patterns, StringBuilder, etc.
 */

export interface SnippetItem {
  label: string;
  insertText: string; // may contain ${1:…} placeholders (Monaco snippet syntax)
  detail: string;
  documentation?: string;
}

export const JAVA_DSA_SNIPPETS: SnippetItem[] = [
  // ─── I/O ────────────────────────────────────────────────────────────────────
  {
    label: "scanner",
    insertText:
      "Scanner sc = new Scanner(System.in);\n" +
      "int ${1:n} = sc.nextInt();",
    detail: "Scanner input",
    documentation: "Khai báo Scanner và đọc int đầu tiên",
  },
  {
    label: "sysout",
    insertText: "System.out.println(${1:value});",
    detail: "System.out.println",
  },
  {
    label: "printf",
    insertText: 'System.out.printf("${1:%d}%n", ${2:value});',
    detail: "System.out.printf",
  },
  {
    label: "readline",
    insertText: "String ${1:line} = sc.nextLine().trim();",
    detail: "Read full line from Scanner",
  },

  // ─── Arrays ─────────────────────────────────────────────────────────────────
  {
    label: "arr",
    insertText: "int[] ${1:arr} = new int[${2:n}];",
    detail: "int array",
  },
  {
    label: "arr2d",
    insertText: "int[][] ${1:grid} = new int[${2:rows}][${3:cols}];",
    detail: "2D int array",
  },
  {
    label: "filla",
    insertText: "Arrays.fill(${1:arr}, ${2:0});",
    detail: "Arrays.fill",
  },
  {
    label: "sorta",
    insertText: "Arrays.sort(${1:arr});",
    detail: "Arrays.sort (ascending)",
  },
  {
    label: "sortar",
    insertText:
      "Integer[] ${1:arr} = new Integer[${2:n}];\n" +
      "Arrays.sort(${1:arr}, Comparator.reverseOrder());",
    detail: "Arrays.sort descending (Integer[])",
  },
  {
    label: "fori",
    insertText:
      "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}",
    detail: "Classic for loop",
  },
  {
    label: "foreach",
    insertText: "for (${1:int} ${2:x} : ${3:arr}) {\n\t${4}\n}",
    detail: "Enhanced for-each loop",
  },

  // ─── Strings ────────────────────────────────────────────────────────────────
  {
    label: "sb",
    insertText:
      "StringBuilder ${1:sb} = new StringBuilder();\n" +
      "${1:sb}.append(${2:value});",
    detail: "StringBuilder",
  },
  {
    label: "split",
    insertText: 'String[] ${1:parts} = ${2:s}.split("${3: }");',
    detail: "String.split",
  },
  {
    label: "charAt",
    insertText: "char ${1:c} = ${2:s}.charAt(${3:i});",
    detail: "String.charAt",
  },
  {
    label: "tochararray",
    insertText: "char[] ${1:chars} = ${2:s}.toCharArray();",
    detail: "String to char array",
  },

  // ─── ArrayList ──────────────────────────────────────────────────────────────
  {
    label: "list",
    insertText:
      "List<${1:Integer}> ${2:list} = new ArrayList<>();",
    detail: "ArrayList",
  },
  {
    label: "listint",
    insertText: "List<Integer> ${1:list} = new ArrayList<>();",
    detail: "ArrayList<Integer>",
  },
  {
    label: "sortlist",
    insertText: "Collections.sort(${1:list});",
    detail: "Collections.sort (ascending)",
  },
  {
    label: "sortlistr",
    insertText: "Collections.sort(${1:list}, Collections.reverseOrder());",
    detail: "Collections.sort descending",
  },

  // ─── Stack / Queue / Deque ──────────────────────────────────────────────────
  {
    label: "stack",
    insertText: "Deque<${1:Integer}> ${2:stack} = new ArrayDeque<>();",
    detail: "Stack (Deque as stack)",
    documentation: "Dùng Deque thay Stack - hiệu năng tốt hơn",
  },
  {
    label: "queue",
    insertText: "Queue<${1:Integer}> ${2:q} = new LinkedList<>();",
    detail: "Queue (FIFO)",
  },
  {
    label: "deque",
    insertText: "Deque<${1:Integer}> ${2:dq} = new ArrayDeque<>();",
    detail: "Deque (double-ended)",
  },

  // ─── PriorityQueue (Heap) ────────────────────────────────────────────────────
  {
    label: "minheap",
    insertText:
      "PriorityQueue<${1:Integer}> ${2:minH} = new PriorityQueue<>();",
    detail: "Min-Heap",
  },
  {
    label: "maxheap",
    insertText:
      "PriorityQueue<${1:Integer}> ${2:maxH} = new PriorityQueue<>(Comparator.reverseOrder());",
    detail: "Max-Heap",
  },
  {
    label: "pqpoll",
    insertText: "${1:int} ${2:top} = ${3:pq}.poll();",
    detail: "PriorityQueue.poll (dequeue min/max)",
  },

  // ─── Map ────────────────────────────────────────────────────────────────────
  {
    label: "map",
    insertText:
      "Map<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();",
    detail: "HashMap",
  },
  {
    label: "treemap",
    insertText:
      "Map<${1:Integer}, ${2:Integer}> ${3:map} = new TreeMap<>();",
    detail: "TreeMap (sorted keys)",
  },
  {
    label: "getordef",
    insertText:
      "${1:map}.getOrDefault(${2:key}, ${3:0})",
    detail: "map.getOrDefault",
  },
  {
    label: "freq",
    insertText:
      "for (${1:int} ${2:x} : ${3:arr}) {\n" +
      "\t${4:freq}.put(${2:x}, ${4:freq}.getOrDefault(${2:x}, 0) + 1);\n" +
      "}",
    detail: "Frequency map (count occurrences)",
  },

  // ─── Set ────────────────────────────────────────────────────────────────────
  {
    label: "hashset",
    insertText: "Set<${1:Integer}> ${2:set} = new HashSet<>();",
    detail: "HashSet",
  },
  {
    label: "treeset",
    insertText: "Set<${1:Integer}> ${2:set} = new TreeSet<>();",
    detail: "TreeSet (sorted)",
  },

  // ─── Graph ──────────────────────────────────────────────────────────────────
  {
    label: "graph",
    insertText:
      "List<List<Integer>> ${1:graph} = new ArrayList<>();\n" +
      "for (int i = 0; i < ${2:n}; i++) ${1:graph}.add(new ArrayList<>());\n" +
      "// ${1:graph}.get(u).add(v); // undirected: add both\n" +
      "// ${1:graph}.get(v).add(u);",
    detail: "Adjacency list graph",
  },
  {
    label: "bfs",
    insertText:
      "Queue<Integer> ${1:bfsQ} = new LinkedList<>();\n" +
      "boolean[] ${2:visited} = new boolean[${3:n}];\n" +
      "${1:bfsQ}.offer(${4:start});\n" +
      "${2:visited}[${4:start}] = true;\n" +
      "while (!${1:bfsQ}.isEmpty()) {\n" +
      "\tint ${5:node} = ${1:bfsQ}.poll();\n" +
      "\tfor (int ${6:nb} : ${7:graph}.get(${5:node})) {\n" +
      "\t\tif (!${2:visited}[${6:nb}]) {\n" +
      "\t\t\t${2:visited}[${6:nb}] = true;\n" +
      "\t\t\t${1:bfsQ}.offer(${6:nb});\n" +
      "\t\t}\n" +
      "\t}\n" +
      "}",
    detail: "BFS template",
  },
  {
    label: "dfs",
    insertText:
      "void dfs(int ${1:node}, boolean[] ${2:visited}, List<List<Integer>> ${3:graph}) {\n" +
      "\t${2:visited}[${1:node}] = true;\n" +
      "\tfor (int ${4:nb} : ${3:graph}.get(${1:node})) {\n" +
      "\t\tif (!${2:visited}[${4:nb}]) dfs(${4:nb}, ${2:visited}, ${3:graph});\n" +
      "\t}\n" +
      "}",
    detail: "DFS recursive template",
  },

  // ─── DP ─────────────────────────────────────────────────────────────────────
  {
    label: "dp1d",
    insertText:
      "int[] ${1:dp} = new int[${2:n} + 1];\n" +
      "${1:dp}[0] = ${3:0};\n" +
      "for (int ${4:i} = 1; ${4:i} <= ${2:n}; ${4:i}++) {\n" +
      "\t${1:dp}[${4:i}] = ${5};\n" +
      "}",
    detail: "1D DP array",
  },
  {
    label: "dp2d",
    insertText:
      "int[][] ${1:dp} = new int[${2:m} + 1][${3:n} + 1];\n" +
      "for (int ${4:i} = 1; ${4:i} <= ${2:m}; ${4:i}++) {\n" +
      "\tfor (int ${5:j} = 1; ${5:j} <= ${3:n}; ${5:j}++) {\n" +
      "\t\t${1:dp}[${4:i}][${5:j}] = ${6};\n" +
      "\t}\n" +
      "}",
    detail: "2D DP array",
  },

  // ─── Binary Search ──────────────────────────────────────────────────────────
  {
    label: "bsearch",
    insertText:
      "int ${1:lo} = 0, ${2:hi} = ${3:n} - 1;\n" +
      "while (${1:lo} <= ${2:hi}) {\n" +
      "\tint ${4:mid} = ${1:lo} + (${2:hi} - ${1:lo}) / 2;\n" +
      "\tif (${5:arr}[${4:mid}] == ${6:target}) {\n" +
      "\t\t// found\n" +
      "\t\tbreak;\n" +
      "\t} else if (${5:arr}[${4:mid}] < ${6:target}) {\n" +
      "\t\t${1:lo} = ${4:mid} + 1;\n" +
      "\t} else {\n" +
      "\t\t${2:hi} = ${4:mid} - 1;\n" +
      "\t}\n" +
      "}",
    detail: "Binary search template",
  },
  {
    label: "bsleft",
    insertText:
      "int ${1:lo} = 0, ${2:hi} = ${3:n};\n" +
      "while (${1:lo} < ${2:hi}) {\n" +
      "\tint ${4:mid} = (${1:lo} + ${2:hi}) / 2;\n" +
      "\tif (${5:arr}[${4:mid}] < ${6:target}) ${1:lo} = ${4:mid} + 1;\n" +
      "\telse ${2:hi} = ${4:mid};\n" +
      "}\n" +
      "// lo = leftmost index where arr[lo] >= target",
    detail: "Binary search left bound",
  },

  // ─── Sorting by custom key ───────────────────────────────────────────────────
  {
    label: "sortcomp",
    insertText:
      "${1:list}.sort((a, b) -> ${2:a} - ${3:b});",
    detail: "Sort list with lambda Comparator",
  },
  {
    label: "sortarr2d",
    insertText:
      "Arrays.sort(${1:arr}, (a, b) -> ${2:a}[0] - ${3:b}[0]);",
    detail: "Sort 2D array by first column",
  },

  // ─── Math utilities ─────────────────────────────────────────────────────────
  {
    label: "maxmin",
    insertText: "Math.max(${1:a}, ${2:b})",
    detail: "Math.max",
  },
  {
    label: "abs",
    insertText: "Math.abs(${1:x})",
    detail: "Math.abs",
  },
  {
    label: "gcd",
    insertText:
      "int gcd(int ${1:a}, int ${2:b}) {\n" +
      "\treturn ${2:b} == 0 ? ${1:a} : gcd(${2:b}, ${1:a} % ${2:b});\n" +
      "}",
    detail: "GCD (Euclidean)",
  },
  {
    label: "mod",
    insertText: "final int MOD = 1_000_000_007;",
    detail: "MOD constant 10^9+7",
  },

  // ─── Pair / Entry ────────────────────────────────────────────────────────────
  {
    label: "pair",
    insertText:
      "int[] ${1:pair} = {${2:first}, ${3:second}};",
    detail: "Simple int[2] pair",
  },
  {
    label: "entry",
    insertText:
      "Map.Entry<${1:Integer}, ${2:Integer}> ${3:e} = new AbstractMap.SimpleEntry<>(${4:k}, ${5:v});",
    detail: "Map.Entry pair",
  },

  // ─── Union-Find (DSU) ────────────────────────────────────────────────────────
  {
    label: "dsu",
    insertText:
      "int[] ${1:parent} = new int[${2:n}];\n" +
      "for (int i = 0; i < ${2:n}; i++) ${1:parent}[i] = i;\n" +
      "\n" +
      "int find(int[] ${1:parent}, int x) {\n" +
      "\tif (${1:parent}[x] != x) ${1:parent}[x] = find(${1:parent}, ${1:parent}[x]);\n" +
      "\treturn ${1:parent}[x];\n" +
      "}\n" +
      "\n" +
      "void union(int[] ${1:parent}, int x, int y) {\n" +
      "\t${1:parent}[find(${1:parent}, x)] = find(${1:parent}, y);\n" +
      "}",
    detail: "Union-Find (DSU) with path compression",
  },

  // ─── Misc ────────────────────────────────────────────────────────────────────
  {
    label: "intmax",
    insertText: "Integer.MAX_VALUE",
    detail: "Integer.MAX_VALUE (2^31 - 1)",
  },
  {
    label: "intmin",
    insertText: "Integer.MIN_VALUE",
    detail: "Integer.MIN_VALUE (-2^31)",
  },
  {
    label: "swap",
    insertText:
      "int ${1:tmp} = ${2:arr}[${3:i}];\n" +
      "${2:arr}[${3:i}] = ${2:arr}[${4:j}];\n" +
      "${2:arr}[${4:j}] = ${1:tmp};",
    detail: "Swap two array elements",
  },
  {
    label: "readintarr",
    insertText:
      "int[] ${1:arr} = new int[${2:n}];\n" +
      "for (int i = 0; i < ${2:n}; i++) ${1:arr}[i] = sc.nextInt();",
    detail: "Read int array from Scanner",
  },
  {
    label: "printarr",
    insertText:
      'System.out.println(Arrays.toString(${1:arr}));',
    detail: "Print array with Arrays.toString",
  },
];

/**
 * Registers the Java DSA completion provider into a Monaco instance.
 * Safe to call multiple times - tracks disposal via a module-level ref.
 */
let _disposable: { dispose(): void } | null = null;

export function registerJavaDSACompletions(monaco: any) {
  // Dispose previous registration (React StrictMode double-mount, HMR, etc.)
  _disposable?.dispose();

  _disposable = monaco.languages.registerCompletionItemProvider("java", {
    triggerCharacters: [],
    provideCompletionItems(
      _model: any,
      _position: any,
      _context: any,
      _token: any,
    ) {
      const suggestions = JAVA_DSA_SNIPPETS.map((s) => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: s.insertText,
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: s.detail,
        documentation: s.documentation ?? "",
        sortText: "0" + s.label, // prefix "0" → sorted before built-ins
      }));
      return { suggestions };
    },
  });
}
