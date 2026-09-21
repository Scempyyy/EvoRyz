# EvoRyz sound effects

Put licensed sound files directly in this folder using these exact names:

`tap.mp3`, `send.mp3`, `message-received.mp3`, `task-complete.mp3`, `habit-complete.mp3`, `goal-complete.mp3`, `streak-milestone.mp3`, `workspace-connected.mp3`, `error.mp3`, `success.mp3`, `notification.mp3`.

No placeholder audio is bundled. The SFX service safely does nothing until these assets are registered in `src/services/sfx.ts`; that single registry is the only integration point, so no UI code needs to change.
