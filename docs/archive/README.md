# Archived — the OpenRouter power-user plan

These documents planned a deep-control OpenRouter client built around
Nano Banana 2 and Muse Image.

**Superseded.** The requirement changed to *"prompt in, uncensored image out,
no parameters"*, which that architecture cannot satisfy at all: the models it
was built around are filtered server-side by Google and Meta, and no client
can change that. See [../decision-uncensored.md](../decision-uncensored.md).

Kept because the engine design (capability discovery, the job pipeline, the
base64 memory handling) is still sound if the goal ever swings back toward
frontier-model quality with deep parameter control.
