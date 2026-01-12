# Pixi Package Manager Documentation

## Overview
Pixi is a modern, fast, and reproducible package management tool designed to simplify project setup and dependency management across multiple languages, including Python, C++, and R. It supports all major operating systems (Linux, Windows, and macOS) and offers features like lockfiles for environment reproducibility and a task runner for managing complex workflows.

Pixi is written in Rust and built on top of the rattler library. It provides isolated environments similar to conda but with better performance and cross-platform support.

## Installation

### macOS and Linux
```bash
curl -fsSL https://pixi.sh/install.sh | sh
```

Alternatively, using Homebrew:
```bash
brew install pixi
```

### Windows
Download the installer from the official website: https://pixi.sh/
Or use PowerShell:
```powershell
iwr https://pixi.sh/install.ps1 -useb | iex
```

After installation, ensure the Pixi binary is in your system's PATH.

## Creating a New Project

### Initialize a Project
```bash
pixi init <project_name>
cd <project_name>
```

This creates a new directory with:
- `pixi.toml` - The project manifest file
- `.gitignore` - Git ignore file
- `.gitattributes` - Git attributes file

### Project Structure
```
project_name/
├── pixi.toml          # Project configuration
├── pixi.lock          # Lockfile (auto-generated)
├── .gitignore
└── .gitattributes
```

## Managing Dependencies

### Adding Dependencies

**Python (conda packages):**
```bash
pixi add python
pixi add python=3.12.*
pixi add numpy pandas
```

**PyPI packages:**
```bash
pixi add --pypi package_name
pixi add --pypi "package_name>=1.2.3"
```

**Conda packages:**
```bash
pixi add package_name
pixi add "package_name~=1.2.3"
```

**Specifying versions:**
- `pixi add python=3.12.*` - Python 3.12.x
- `pixi add "numpy>=1.20,<2.0"` - Version range
- `pixi add "package~=1.2.3"` - Compatible release

### Removing Dependencies
```bash
pixi remove package_name
```

### Updating Dependencies
```bash
pixi update                    # Update all packages
pixi update package_name       # Update specific package
```

## Running Scripts

### Direct Execution
```bash
pixi run python script.py
pixi run python -m pytest
```

### Using Tasks
Define tasks in `pixi.toml`:
```toml
[tasks]
hello = { cmd = ["python", "hello_world.py"] }
test = { cmd = ["python", "-m", "pytest"] }
start = { cmd = ["python", "app.py"] }
```

Run tasks:
```bash
pixi run hello
pixi run test
pixi run start
```

### Shell Access
Activate the Pixi environment:
```bash
pixi shell
```

This opens a new shell with all dependencies available in the PATH.

## Configuration File (pixi.toml)

### Basic Structure
```toml
[workspace]
name = "my_project"
version = "0.1.0"
authors = ["Your Name <email@example.com>"]
channels = ["conda-forge"]
platforms = ["win-64", "linux-64", "osx-64", "osx-arm64"]

[dependencies]
python = "3.12.*"
numpy = ">=1.20"

[pypi-dependencies]
requests = ">=2.28.0"
flask = ">=2.0.0"

[tasks]
start = { cmd = ["python", "app.py"] }
test = { cmd = ["python", "-m", "pytest"] }
```

### Configuration Sections

**`[workspace]`** - Project metadata
- `name` - Project name
- `version` - Project version
- `authors` - List of authors
- `channels` - Conda channels to use (default: ["conda-forge"])
- `platforms` - Target platforms (e.g., ["win-64", "linux-64", "osx-64", "osx-arm64"])

**`[dependencies]`** - Conda/conda-forge packages
- Add packages from conda channels
- Examples: `python`, `numpy`, `pandas`, `matplotlib`

**`[pypi-dependencies]`** - PyPI packages
- Python packages from PyPI
- Examples: `requests`, `flask`, `django`

**`[tasks]`** - Task definitions
- Define reusable commands
- Can reference other tasks
- Support dependencies between tasks

### Advanced Task Configuration
```toml
[tasks]
build = { cmd = ["python", "setup.py", "build"] }
test = { cmd = ["python", "-m", "pytest"], depends_on = ["build"] }
```

## Common Commands

```bash
# Project management
pixi init <name>              # Initialize new project
pixi install                  # Install all dependencies
pixi update                   # Update all dependencies

# Dependency management
pixi add <package>            # Add conda package
pixi add --pypi <package>     # Add PyPI package
pixi remove <package>         # Remove package
pixi update <package>         # Update specific package

# Execution
pixi run <command>            # Run command in environment
pixi run <task>               # Run defined task
pixi shell                    # Activate environment shell

# Information
pixi info                     # Show project information
pixi list                     # List installed packages
```

## Best Practices

1. **Version Pinning**: Pin Python versions explicitly (e.g., `python = "3.12.*"`)
2. **Lockfiles**: Commit `pixi.lock` to version control for reproducibility
3. **Channels**: Use `conda-forge` as the primary channel for conda packages
4. **Platforms**: Specify target platforms explicitly in `pixi.toml`
5. **Tasks**: Use tasks for common operations instead of remembering long commands
6. **PyPI vs Conda**: Use conda packages when available, PyPI for Python-only packages

## Example Workflow

1. **Create project:**
   ```bash
   pixi init my_project
   cd my_project
   ```

2. **Add dependencies:**
   ```bash
   pixi add python=3.12.*
   pixi add numpy pandas matplotlib
   pixi add --pypi requests
   ```

3. **Create script:**
   ```python
   # main.py
   import numpy as np
   import requests
   
   print("Hello from Pixi!")
   ```

4. **Run script:**
   ```bash
   pixi run python main.py
   ```

5. **Or define task:**
   ```toml
   [tasks]
   run = { cmd = ["python", "main.py"] }
   ```
   ```bash
   pixi run run
   ```

## Troubleshooting

- **Environment not found**: Run `pixi install` to create the environment
- **Package not found**: Check channels and platform compatibility
- **Version conflicts**: Use version constraints or update packages
- **Lockfile issues**: Delete `pixi.lock` and run `pixi install` to regenerate

## Resources

- Official Documentation: https://pixi.sh/
- GitHub Repository: https://github.com/prefix-dev/pixi
- Conda-forge Channel: https://conda-forge.org/

