include Makefile-utils.mk

#
# Calypso
#
.PHONY: pre-start
pre-start: welcom versions

versions: B = $(FG_BLUE)
versions: R = $(FG_RED)
versions: Z = $(FG_RESET)
versions: $(NODE) $(NPM)
	@export EXPECTED_NODE=`$(NODE) -e 'console.log(require(".$/package.json").engines.node.split(".")[0])'`; \
	export ACTUAL_NODE=`$(NODE) -v | sed -n 's/^v\([0-9]*\).*/\1/p'`; \
	if [ $$EXPECTED_NODE != $$ACTUAL_NODE ]; then \
		echo -e "$Rx$Z node major version is $R$$ACTUAL_NODE$Z but we need $B$$EXPECTED_NODE$Z"; \
		exit 1; \
	fi; \
	export EXPECTED_NPM=`$(NODE) -e 'console.log(require(".$/package.json").engines.npm.split(".")[0])'`; \
	export ACTUAL_NPM=`$(NPM) -v | sed -n 's/^\([0-9]*\).*/\1/p'`; \
	if [ $$EXPECTED_NPM != $$ACTUAL_NPM ]; then \
		echo -e "$Rx$Z npm major version is $R$$ACTUAL_NPM$Z but we need $B$$EXPECTED_NPM$Z"; \
		exit 1; \
	fi; \
	$~

.PHONY: welcome
welcome:
	@echo -e "$(FG_CYAN)"; cat bin$/welcome.txt; echo -e "$(TERM_RESET)"

#
# Linting
#
.PHONY: lint
lint: lint-config lint-css lint-js

lint-config: config
	$(NODE) server$/config$/validate-config-keys.js
	$~

lint-css: CHANGED = $(filter %.scss,$?)
lint-css: ARGS = $(call when-more-than,100,client$/**$/*.scss,$(CHANGED))
lint-css: $(FILES_SCSS) | $(call npm-deps,stylelint)
	$(NPM_BIN)stylelint --syntax scss $(ARGS)
	$~

lint-js: CHANGED = $(filter %.js %.jsx,$?)
lint-js: ARGS = $(call when-more-than,100,.,$(CHANGED))
lint-js: $(FILES_JS) | $(call npm-deps,eslint-eslines)
	$(NPM_BIN)eslint-eslines $(ARGS)
	$~

#
# Git
#
.PHONY: pre-push
pre-push: | contribution-message
  ifeq (master,$(GIT_BRANCH))
	read -n 1 -p "You're about to push !!![ $(GIT_BRANCH) ]!!!, is that what you intended? " CONFIRM; \
	echo; \
	if [[ ! $$CONFIRM =~ ^[Yy]$$ ]]; then exit 1; fi
  endif

.PHONY: pre-commit
.SECONDEXPANSION: pre-commit
pre-commit: DIRTY = $(sort $(filter %.js %.jsx %.scss,$(shell git diff $1 --name-only --diff-filter=ACM)))
pre-commit: READY = $(call list-diff,$(call DIRTY,--cached),$(DIRTY))
pre-commit: NEWER = $(call list-same,$(sort $?),$(READY))
pre-commit: FILES = $(call when-more-than,0,$(READY),$(NEWER))
pre-commit: lint-config $$(READY) | $(call npm-deps,eslint-eslines prettier) contribution-message
	$(call when-not-empty,$(NEWER), \
		$(info Formatting unmodified files staged for commit) \
		$(NPM_BIN)prettier --require-pragma --write $(FILES) && \
			git add $(FILES) && \
			$(NPM_BIN)eslint-eslints --diff=index $(filter-out %.scss,$(FILES)) \
	)
	$~

.PHONY: contribution-message
contribution-message:
	$(info By contributing to this project, you license the materials you contribute)
	$(info under the GNU General Public License v2 (or later). All materials must have)
	$(info GPLv2 compatible licenses — see .github/CONTRIBUTING.md for details.)
	$(info )

#
# Cleaning
#
.PHONY: clean
clean: clean-build clean-devdocs clean-public

.PHONY: clean-build
clean-build:
	$(RM) build server$/bundler$/*.json .babel-cache

.PHONY: clean-devdocs
clean-devdocs:
	$(RM) $(addprefix server$/devdocs$/,search-index.js prototypes-index.json components-usage-stats.json)

.PHONY: clean-public
	$(RM) \
		$(addprefix public$/*.,css css.map js js.map) \
		$(addprefix public$/sections$/*.,css css.map) \
		$(addprefix public$/sections-rtl$/*.,css css.map)
