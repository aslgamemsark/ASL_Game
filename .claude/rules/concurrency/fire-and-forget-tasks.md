# Fire-and-Forget Tasks

### Every asynchronous task must be awaited, tracked, or explicitly justified

In most async runtimes, a task that is started but never awaited or referenced can be
silently garbage-collected before it finishes. If it raises an exception, that exception is
discarded — visible at best as a quiet background warning, invisible at worst. If the
program exits before the task completes, the task may never run at all.

BAD:
```
async def handle_request(req):
    asyncio.create_task(log_to_analytics(req))   # never awaited; exception silently lost
    return response
```

GOOD:
```
async def handle_request(req):
    task = asyncio.create_task(log_to_analytics(req))
    task.add_done_callback(lambda t: logger.error(t.exception()) if t.exception() else None)
    return response
```

Or, if the result genuinely doesn't matter and failure is truly acceptable:
```
# Fire-and-forget is intentional here: analytics loss is acceptable on failure.
# Exception is still logged so it's not invisible.
asyncio.create_task(_log_analytics(req))
```

Rule: any code that starts background or async work must store a reference to it and either
await it, check its result, or attach an explicit error-handling callback. A bare fire-and-
forget is a code-review red flag by default. If it is genuinely intentional, it must be
commented as such and must still log exceptions rather than letting them vanish silently.

---

### Callbacks and event handlers are not exempt

Async work triggered inside a callback or event handler needs the same tracking discipline
as top-level async work — it is easy to forget that a synchronous callback running inside an
event loop does not automatically make everything it kicks off tracked or awaited.

BAD:
```
def on_message_received(msg):
    asyncio.create_task(process_and_save(msg))   # handler returns immediately; task untracked
```

Rule: an async task created inside a callback is just as untracked as one created at the
top level. The fact that it was triggered from inside an event handler does not make it safe.
