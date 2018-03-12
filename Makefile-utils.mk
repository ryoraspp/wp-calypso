# Portability
ifdef ComSpec
	RM := del /F /Q
    SLASH :=\\
else
	RM := rm -rf
    SLASH :=/
endif

# Use $/ as the path separator
/ := $(strip $(SLASH))

# File classes
FILES_JS := $(shell \
	find . \
		-not \( -path '.$/.git' -prune \) \
		-not \( -path '.$/build' -prune \) \
		-not \( -path '.$/node_modules' -prune \) \
		-not \( -path '.$/public' -prune \) \
		-type f \
		\( -name '*.js' -or -name '*.jsx' \) \
)

FILES_SCSS := $(shell \
	find client assets \
		-type f \
		-name '*.scss' \
)

# node/npm helpers
NPM_BIN := node_modules$/.bin$/
NODE    := node
NPM     := npm

# $(call npm-deps,package-a package-b package-c)
npm-deps = $(addprefix node_modules$/,$1)

.SECONDARY: node_modules%
node_modules$/%: npm-shrinkwrap.json package.json
	$(NPM) install $(notdir $@)

# Optimizing phony targets that should
# only run when their dependencies change
BOOT := $(shell mkdir -p .make-cache)
TOUCH_CACHE = touch .make-cache$/
~ = $(strip $(TOUCH_CACHE))$(subst $/,-,$@)

vpath lint% .make-cache

# Convenience utilities

# $(call when-big,default,list)
when-more-than = $(if $(shell [ $(words $2) -lt 100 ] && echo lt),$2,$1)

# Reset make
.POSIX:
.SUFFIXES:
UNQUIET ?= --quiet
UNQUIET :=
MAKEFLAGS += --no-builtin-rules $(UNQUIET)
