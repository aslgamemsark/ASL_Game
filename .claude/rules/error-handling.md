# Error Handling

### Define errors out of existence first
Before writing an error handler, ask: can I redesign the API so this error cannot occur?

BAD: unset(varname) throws VariableNotFoundError — every caller wraps it in try/catch
GOOD: redefine unset as "ensure variable does not exist" — if already gone, return silently. Error defined away.

BAD: Windows blocks deletion of open files — causes crashes and user frustration
GOOD: Unix marks file for deletion, frees disk when last handle closes — no error for deleter, no error for readers

Rule: this is not the same as suppressing errors. Suppressing = catching and ignoring. Defining away = redesigning the semantics so the error condition cannot arise.

---

### Mask exceptions inside the module
If your module can handle an exception internally, handle it there. Do not surface it to callers who cannot act on it.

BAD: network module throws PacketDroppedException — every caller must implement retry logic
GOOD: TCP retransmits dropped packets silently — callers get a clean stream

Rule: only surface an exception if the caller has information or authority to handle it that the module does not have. If the module can resolve it, resolve it internally.
Limit: do not mask exceptions that callers genuinely need to know about. If the server is permanently down, the caller needs to know — masking that would hide critical information.

---

### Aggregate exceptions — one handler not fifty
Let exceptions propagate to one place that handles all of them. Do not wrap every call in its own try/catch.

BAD:
`python
try:
    photo_id = get_parameter("photo_id")
except NoSuchParameter:
    return error_response("missing photo_id")
try:
    user_id = get_parameter("user_id")
except NoSuchParameter:
    return error_response("missing user_id")
`
GOOD:
`python
def dispatch(request):
    try:
        handle(request)
    except NoSuchParameter as e:
        return error_response(e.message)  # one handler catches all
`

Rule: if multiple catch blocks in different places do the same thing, they belong in one place higher up the stack.

---

### For unrecoverable errors — crash fast with a clear message
Out of memory, disk corruption, internal inconsistency — you cannot recover from these meaningfully.

BAD: malloc returns NULL, every caller checks return value, handles it differently, most forget to check
GOOD: ckalloc() wraps malloc, aborts immediately with a clear message if allocation fails

Rule: if the only honest response to an error is "this should never happen and we cannot continue," crash immediately at the point of detection with a message that explains what happened.