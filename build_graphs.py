import numpy as np
import glob
import json
import matplotlib.pyplot as plt
from collections import Counter

def most_frequent(List):
    occurence_count = Counter(List)
    return occurence_count.most_common(1)[0][0]

names = [x.split("/")[-1] for x in glob.glob("./combined_submissions/*")]
print(names)
names.sort(key=lambda x: (x.split("_")[3], x.split("_")[2]))

result_dict = {}
for name in names:
	l = []
	files = glob.glob("./combined_submissions/" + name + "/*.json")
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
	for t in ["L0", "L1", "L2", "true", "false"]: # "L1", 
		res_typed[t] = []

	for name in names:
		l = result_dict[name]
		local = []
		for j in l:
			v = calc_func(j)
			if v is not None:
				local.append(v)
		# local = np.array(local)

		"""
		# remove outliers
		mean = np.mean(local)
		normalized = local - mean

		std = np.std(local)
		normalized /= std

		res_std = np.std(normalized)

		result = []
		for i in range(local.shape[0]):
			actual = local[i]
			normed = normalized[i]
			if normed < 3 * res_std:
				result.append(actual)
		"""

		y = np.mean(local)
		e = np.std(local) / 4
		# y = most_frequent(local)
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
	plt.errorbar(xs, ys, fmt='o', yerr=es, markersize=8, capsize=8) # 

	for key, value in res_typed.items():
		values = res_typed[key]
		# print('values', values)
		avg = np.mean(values)
		plt.plot([-1, 6], [avg, avg], label=key)

	plt.legend()
	plt.title(fname)
	plt.savefig('./figures/' + fname + '.png')

def func_attention(j):
	return 1 if j['attention']['A1'] == 8 else 0
calculate("Attention Correct (higher is better)", func_attention)

def func_accuracy(j):
	if j['attention']['A1'] != 8:
		return None

	answers = j['task']
	res = np.array([int(answers["Q" + str(x)]) for x in range(1, 7)])
	actual = np.array([2, 3, 1, 3, 0, 1])
	diff = actual - res
	diff = np.square(diff)
	# print('diff', diff)
	return np.mean(diff)
calculate("Mean Squared Error Answers (lower is better)", func_accuracy)

def func_overall_clarity(j):
	if j['attention']['A1'] != 8:
		return None
	return int(j['survey']['S3'])
calculate("Overall Clarity (higher is better)", func_overall_clarity)

def func_goal_clarity(j):
	if j['attention']['A1'] != 8:
		return None
	return int(j['survey']['S1'])
calculate("Goal Clarity (higher is better)", func_goal_clarity)

def func_role_clarity(j):
	if j['attention']['A1'] != 8:
		return None
	return int(j['survey']['S2'])
calculate("Role Clarity (higher is better)", func_role_clarity)
