#!/usr/bin/env python3
# -*- coding:utf-8 -*-

import os
import sys
import util.fs

target = "debug"

#+  ██████  ███████ ████████      ██████ ██      ██      █████  ██████   ██████  ███████
#+ ██       ██         ██        ██      ██      ██     ██   ██ ██   ██ ██       ██
#+ ██   ███ █████      ██        ██      ██      ██     ███████ ██████  ██   ███ ███████
#+ ██    ██ ██         ██        ██      ██      ██     ██   ██ ██   ██ ██    ██      ██
#+  ██████  ███████    ██         ██████ ███████ ██     ██   ██ ██   ██  ██████  ███████
if sys.argv.__len__() == 2:
	#check for other options
	#else:
	target = sys.argv[1]
 
#+
#+
#+ copy directory structure from /src
#+
#+
inputpath = './src'
outputpath = './build'
if not os.path.isdir(outputpath):
	os.mkdir(outputpath)
for dirpath, dirnames, filenames in os.walk(inputpath):
    structure = os.path.join(outputpath, dirpath[len(inputpath)+1:])
    if not os.path.isdir(structure):
        os.mkdir(structure)

#+ ██████  ██    ██ ███    ██     ████████  █████  ██████   ██████  ███████ ████████
#+ ██   ██ ██    ██ ████   ██        ██    ██   ██ ██   ██ ██       ██         ██
#+ ██████  ██    ██ ██ ██  ██        ██    ███████ ██████  ██   ███ █████      ██
#+ ██   ██ ██    ██ ██  ██ ██        ██    ██   ██ ██   ██ ██    ██ ██         ██
#+ ██   ██  ██████  ██   ████        ██    ██   ██ ██   ██  ██████  ███████    ██
import targets.debug
import targets.release
import targets.clean

if(target == "debug"):
	exit (targets.debug.run())
elif(target == "release"):
	exit (targets.release.run())
elif(target == "clean"):
	exit (targets.clean.run())
else:
	print("\033[31mERROR:\033[0m target: \"",target,"\" not found",sep = '')
	exit (1)
