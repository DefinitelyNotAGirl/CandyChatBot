server:
	npx tsc

all:
	npx tsc
	make -C ./web/APIMessage
	make -C ./web/dashboard
	make -C ./web/error-page

launch:
	node build/bot.js
