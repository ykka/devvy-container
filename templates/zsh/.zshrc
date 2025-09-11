# Path to your oh-my-zsh installation
export ZSH="$HOME/.oh-my-zsh"

# ZSH Config
ZSH_THEME="robbyrussell"

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git z tmux)

source $ZSH/oh-my-zsh.sh

# Container detection and prompt customization
# This runs after oh-my-zsh loads so we can modify the PROMPT
if [[ -f /.dockerenv ]] || [[ -n "$DEVCONTAINER" ]] || grep -q 'docker\|lxc' /proc/1/cgroup 2>/dev/null; then
    # We're in a container - custom prompt with directory and git info
    PROMPT="%{$fg_bold[cyan]%}🛡️devvy%{$reset_color%} %{$fg[yellow]%}%c%{$reset_color%} "
    PROMPT+='$(git_prompt_info)'
fi

# Display custom MOTD on login (only for interactive shells)
if [[ -o interactive ]] && [[ -f /usr/local/bin/devvy-motd.sh ]]; then
    /usr/local/bin/devvy-motd.sh
fi

# Add npm global packages to PATH
export PATH="$HOME/.npm-global/bin:$PATH"

# Aliases
alias zshconfig="nvim ~/.zshrc"
alias ohmyzsh="nvim ~/.oh-my-zsh"
alias vim="nvim"
alias claudy="claude --dangerously-skip-permissions"

