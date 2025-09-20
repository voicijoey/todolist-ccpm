---
created: 2025-09-20T20:15:27Z
last_updated: 2025-09-20T20:15:27Z
version: 1.0
author: Claude Code PM System
---

# Project Structure Context

## Directory Organization

### Root Level Structure
```
todolist-ccpm/
├── .claude/                 # CCPM framework and project management
├── .spec-workflow/          # Specification workflow system
├── .git/                   # Git version control
├── .gitignore              # Git ignore patterns
├── README.md               # Project documentation
├── LICENSE                 # MIT license
└── screenshot.webp         # Project screenshot
```

### CCPM Framework Structure (.claude/)
```
.claude/
├── CLAUDE.md              # Instructions for Claude Code instances
├── agents/                # Specialized sub-agents for context optimization
│   ├── code-analyzer.md   # Bug hunting and code analysis
│   ├── file-analyzer.md   # File content summarization
│   ├── parallel-worker.md # Multi-stream coordination
│   └── test-runner.md     # Test execution with logging
├── commands/              # Command definitions (markdown-based)
│   ├── context/          # Context management commands
│   ├── pm/               # Project management commands (30+ commands)
│   ├── testing/          # Test execution commands
│   ├── prompt.md         # General prompt command
│   └── re-init.md        # Re-initialization command
├── context/              # Project-wide context files
│   └── README.md         # Context system documentation
├── epics/                # Local workspace (git-ignored for privacy)
│   ├── .gitkeep         # Preserve directory structure
│   └── todolist/        # Current epic workspace
│       ├── epic.md      # Epic implementation plan
│       ├── 2.md         # Database & API Foundation (Issue #2)
│       ├── 3.md         # Authentication System (Issue #3)
│       ├── 4.md         # Core CRUD Operations (Issue #4)
│       ├── 5.md         # UI Components (Issue #5)
│       ├── 6.md         # Priority & Categories (Issue #6)
│       ├── 7.md         # Search & Filtering (Issue #7)
│       ├── 8.md         # Notifications (Issue #8)
│       ├── 9.md         # Analytics & Export (Issue #9)
│       └── github-mapping.md # GitHub issue mapping
├── prds/                 # Product Requirements Documents
│   ├── .gitkeep         # Preserve directory structure
│   └── todolist.md      # Todolist PRD
├── rules/                # Behavioral rules and patterns
├── scripts/              # Shell automation scripts
└── settings.local.json   # Local tool permissions
```

### Development Workspace
```
../epic-todolist/          # Git worktree for development
└── [Same structure as main, isolated branch: epic/todolist]
```

## File Naming Patterns

### Epic & Task Files
- **Epic files**: `{feature-name}/epic.md`
- **Task files**: `{feature-name}/{github-issue-number}.md`
- **PRD files**: `{feature-name}.md`

### Command Files
- **Pattern**: `{category}/{command-name}.md`
- **Frontmatter**: Tool permissions and metadata
- **Content**: Structured markdown instructions

### Context Files
- **Pattern**: `{context-type}.md`
- **Frontmatter**: Creation/update timestamps, version info
- **Content**: Project-specific knowledge and patterns

## Module Organization

### CCPM System Components
1. **Command System**: Markdown-based commands with frontmatter permissions
2. **Agent System**: Specialized sub-agents for context optimization
3. **Epic Management**: Local task workspace with GitHub synchronization
4. **Context System**: Project knowledge and patterns preservation

### GitHub Integration Pattern
- **Epic Issue**: Parent issue with epic overview
- **Task Issues**: Child issues via gh-sub-issue extension
- **File Mapping**: Local task files mapped to GitHub issue numbers
- **Sync Strategy**: Local development with controlled GitHub synchronization

## Design Patterns

### Frontmatter Convention
All structured files use YAML frontmatter:
```yaml
---
name: {identifier}
status: {backlog|open|in-progress|completed}
created: {ISO-8601-datetime}
updated: {ISO-8601-datetime}
github: {github-url}
# Additional metadata specific to file type
---
```

### Command Structure
```markdown
---
allowed-tools: Bash, Read, Write, LS, Task
---

# Command Title
Command description and usage instructions
```

### Dependency Management
- **Sequential Dependencies**: Tasks that must complete before others
- **Parallel Opportunities**: Independent tasks marked for concurrent execution
- **Conflict Detection**: Tasks that modify same files identified

## Integration Points

### External Systems
- **GitHub Issues**: Task and epic tracking
- **Git Worktrees**: Isolated development environments
- **GitHub CLI**: Issue management and synchronization

### Internal Systems
- **Agent Coordination**: Sub-agents for heavy lifting operations
- **Context Preservation**: Session state and project knowledge
- **Progress Tracking**: Real-time status updates and completion tracking