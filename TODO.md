# To-Do List for esimba

- maybe combine address & port into bind and be smart about pulling scheme, address and port out?
- option to only watch files, without launching browser or server
- add additional parameters to esbuild, for example 'loader'
- officialize support for esbuild.config.json and esbuild section in package.json
- add html scanner (scans all html files in srcdir and copy over to outdir)
- add html parser (to detect and patch <script module src=... /> entries)
- create default index.html in outdir if not found and watching (or also for all commands?)
- support for watching assets directory and using copyAssets() while watching
- strip out duplicate srcdir if already specified as part of the entrypoint (silly user error)
- check that esbuild is installed with support for plugins
- consider replacing command line interface commander by caporal (better features, but adds dependencies)
- clean up package.json and helper script (still a mess!)
