Still TODO:
1. Fix notification permission sync - web-manager's permission check in initialize() should be clearing localStorage when permission is 'denied' , but it's not taking effect. Need to debug why - might be webpack cache, timing issue, or the check not running. The code is in web-manager/src/index.js line 137-146. Also need the account page Ul to reflect the real state.
2. Get push notifications actually delivered - the FCM sendEach) succeeds ( sent: 1) but no notification appears. The onBackgroundMessage handler was added to the service worker but hasn't been verified working yet. Token is: dzRAvnrFB5RHok0FNTHyRB:APA91bFY-fnVkuyz3DldU0rQu7HUnIQAVMaS0274KСА0L1UYa06hЗm79YMzfuQV4U14vCоAnA65EYFdIеljh5pgLGЗ0ЕZq7Е_iPcGuLhgG2UHyВ3Sis3lo 3. Calendar view push support - the campaign editor creates push campaigns but the Ul needs work (fields hidden/shown by type, preview for push). The POST route now fires push immediately when sendAt: "now" (same as email).
4. Account page button state - the "Enable push notifications" button doesn't disable after successful subscribe (FormManager re-enables it). The setTimeout (100) fix was added but not verified.
5. Frontend items from original TODO - campaign Ul preview improvements, list+segments AND/intersection clarity (labels updated but not verified visually).
6. Consumer project commits - ITW, Replyify, Slapform changes are unstaged, not committed.
7. BEM needs another prepare + publish for the push notification changes (notification.js brand defaults, campaign POST push dispatch, push-send test, schema filters field).


cd /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-backend/functions && TEST_EXTENDED_MODE=true TEST_FCM_TOKEN="cml8NxDH-vL_MLTQcTRGIy:APA91bFrhgEPlk9lJWr8dS9ap_MsnVCpKKBID7ElK9F__PxbE3uDxeHeYLYfepHSme0itL-zjgaOmilHHs0LV1ajjvlAnmUePrJqGgiOL-eipGJ6jsWNmCQ" npx mgr test routes/marketing/push-send 2>&1


Okay. Now I want you to put the automatic subscription call In some strategic places, and don't forget that it needs to be after a user interaction such as a click. So I'm thinking what about right when they click sign in or sign up?
