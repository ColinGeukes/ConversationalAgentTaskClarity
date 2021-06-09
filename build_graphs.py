import numpy as np
import glob
import json
import matplotlib.pyplot as plt

names = [x.split("/")[-1] for x in glob.glob("./f_submissions/*")]
print(names)
names.sort(key=lambda x: (x.split("_")[3], x.split("_")[2]))

result_dict = {}
for name in names:
	l = []
	files = glob.glob("./f_submissions/" + name + "/*.json")
	for f in files:
		with open(f, 'r') as of:
			j = json.load(of)
		l.append(j)
	result_dict[name] = l

print("Loaded files!")

def calculate(fname, calc_func):
	xs = []
	ys = []
	es = []
	
	res_typed = {}
	for t in ["L0", "L1", "L2", "true", "false"]:
		res_typed[t] = []

	for name in names:
		l = result_dict[name]
		local = []
		for j in l:
			v = calc_func(j)
			if v is not None:
				local.append(v)

		y = np.mean(local)
		e = np.std(local)
		data = name.split("_")[2:4]
		xs.append(str(data))
		ys.append(y)
		es.append(e)

		le = data[0]
		it = data[1]
		res_typed[le].append(y)
		res_typed[it].append(y)

	plt.figure()
	axes = plt.gca()
	# axes.set_ylim([0,1])
	plt.xticks(rotation=16)
	plt.errorbar(xs, ys, yerr=es, fmt='o', markersize=8, capsize=8)

	for key, value in res_typed.items():
		values = res_typed[key]
		avg = np.mean(values)
		plt.plot([-1, 7], [avg, avg], label=key)

	plt.legend()
	plt.title("Graph " + fname)
	plt.savefig('./figures/' + fname + '.png')

def func_attention(j):
	return 1 if j['attention']['A1'] == 8 else 0
calculate("Attention Correct", func_attention)

def func_accuracy(j):
	if j['attention']['A1'] != 8:
		return None

	answers = j['task']
	res = np.array([int(answers["Q" + str(x)]) for x in range(1, 7)])
	actual = np.array([2, 3, 1, 3, 0, 1])
	diff = actual - res
	diff = np.square(diff)
	return np.mean(diff)
calculate("Mean Squared Error Answers", func_accuracy)

def func_overall_clarity(j):
	if j['attention']['A1'] != 8:
		return None
	return int(j['survey']['S3'])
calculate("Overall Clarity", func_overall_clarity)

def func_goal_clarity(j):
	if j['attention']['A1'] != 8:
		return None
	return int(j['survey']['S1'])
calculate("Goal Clarity", func_goal_clarity)

def func_role_clarity(j):
	if j['attention']['A1'] != 8:
		return None
	return int(j['survey']['S2'])
calculate("Role Clarity", func_role_clarity)

