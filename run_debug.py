import os
import platform

def execute(cmd: str):
	if os.system(cmd) != 0:
		exit (1)

def CreateDirectory(path: str):
	if not os.path.isdir(path):
		os.system("mkdir "+path)

def DeleteFile(path: str):
	os.system("rm "+path)

def CMDtoHTML(cmd: str,dst: str):
	execute(cmd+" &> "+dst)
	execute("ansiToHtml "+dst)
	DeleteFile(dst)

execute("python ./build-system/main.py debug")
execute("./server")
print("done")
