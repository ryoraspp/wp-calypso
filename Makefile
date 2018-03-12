include Makefile-utils.mk

node_modules: npm-shrinkwrap.json
	$(NPM) install

#
# Linting
#
lint: lint-config lint-css lint-js
	$~

lint-config: config
	$(NODE) server$/config$/validate-config-keys.js
	$~

lint-css: CHANGED = $(filter %.scss,$?)
lint-css: ARGS = $(call when-big,client$/**$/*.scss,$(CHANGED))
lint-css: $(call npm-deps,stylelint) $(FILES_SCSS)
	$(NPM_BIN)stylelint --syntax scss $(ARGS)
	$~

lint-js: CHANGED = $(filter %.js %.jsx,$?)
lint-js: ARGS = $(call when-big,.,$(CHANGED))
lint-js: $(call npm-deps,eslint-eslines) $(FILES_JS)
	$(NPM_BIN)eslint-eslines $(ARGS)
	$~

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
