import numpy as np
import statsmodels.api as sm
from statsmodels.formula.api import ols
import pandas
import os
import json

correct_answers = [2, 3, 1, 3, 0, 1]  # Sander his answers to our tasks
modus_answers = []
mean_answers = []

task_answers = [[], [], [], [], [], []]
for interactive in [False, True]:  # True for interactive and False for non-interactive
    for msg_length in [0, 1, 2]:  # 0 for short, 1 for medium and 2 for long
        directory = fr'../combined_submissions/s2_submissions_L{msg_length}_{interactive}'
        for entry in os.scandir(directory):
            if entry.path.endswith(".json") and entry.is_file():
                # print(entry.path)
                with open(entry.path) as f:
                    data = json.loads(f.readline())
                    if data['attention']['A1'] == 8:
                        individual_answers = []
                        for task in range(len(data['task'])):
                            given_answer = data['task']['Q' + str(task + 1)]
                            task_answers[task].append(given_answer)
similarity = [0, 0, 0, 0, 0, 0]
for i in range(len(task_answers)):
    modus_answers.append(max(set(task_answers[i]), key=task_answers[i].count))
    mean_answers.append(np.mean(task_answers[i]))
    if modus_answers[i] == correct_answers[i]:
        similarity[i] = 1
print(modus_answers)
print("similarity between ground truth and most frequent answer: " + str(similarity.count(1) / len(similarity)))

data_list = {'text_length': [], 'interactive': [], 'overall_clarity': [], 'task_score': [], 'task_score_modus': [],
             'task_score_mean': [], 'intro_time': []}
for interactive in [False, True]:  # True for interactive and False for non-interactive
    for msg_length in [0, 1, 2]:  # 0 for short, 1 for medium and 2 for long
        directory = fr'../combined_submissions/s2_submissions_L{msg_length}_{interactive}'
        for entry in os.scandir(directory):
            if entry.path.endswith(".json") and entry.is_file():
                # print(entry.path)
                with open(entry.path) as f:
                    data = json.loads(f.readline())
                    if data['attention']['A1'] == 8:
                        data_list['text_length'].append(data['params']['textLength'])
                        data_list['interactive'].append(data['params']['interactiveness'])
                        data_list['overall_clarity'].append(data['survey']['S3'])
                        for flow_entry in data['flow']:
                            if flow_entry['button'] == 'startthetask':
                                data_list['intro_time'].append(flow_entry['timeTotal']/1000)
                        sum_scores = 0
                        modus_scores = 0
                        mean_scores = 0
                        for task in range(len(data['task'])):
                            given_answer = data['task']['Q' + str(task + 1)]
                            sum_scores += abs(correct_answers[task] - given_answer)
                            modus_scores += abs(modus_answers[task] - given_answer)
                            mean_scores += abs(mean_answers[task] - given_answer)
                        data_list['task_score'].append(sum_scores)
                        data_list['task_score_modus'].append(modus_scores)
                        data_list['task_score_mean'].append(mean_scores)

df = pandas.DataFrame(data=data_list)

# ANOVA overall_clarity vs text_length and interactive
m = ols("overall_clarity ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova-task-clarity.csv')
print(anova)
print("ANOVA perceived overall task clarity")
print("------------------------------------------------------------------------\n")

# ANOVA Correct answers - ground truth
m = ols("task_score ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova-task-score-ground-truth.csv')
print(anova)
print("ANOVA task scores ground truth")
print("------------------------------------------------------------------------\n")

# ANOVA Correct answers - modus score
m = ols("task_score_modus ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova-task-score-modus.csv')
print(anova)
print("ANOVA task scores most frequent answer as ground truth")
print("------------------------------------------------------------------------\n")

# ANOVA Correct answers - mean score
m = ols("task_score_mean ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova-task-score-mean.csv')
print(anova)
print("ANOVA task scores mean answers as ground truth")

# ANOVA Correct answers - mean score
m = ols("intro_time ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova-task-intro-time.csv')
print(anova)
print("ANOVA intro time")