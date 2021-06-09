import numpy as np
import statsmodels.api as sm
from statsmodels.formula.api import ols
import pandas
import os
import json

correct_answers = [2, 3, 1, 3, 0, 1]

data_list = {'text_length': [], 'interactive': [], 'overall_clarity': [], 'task_score': []}
for interactive in [False, True]:  # True for interactive and False for non-interactive
    for msg_length in [0, 1, 2]:  # 0 for short, 1 for medium and 2 for long
        directory = fr'../f_submissions/f_submissions_L{msg_length}_{interactive}_20p'
        for entry in os.scandir(directory):
            if entry.path.endswith(".json") and entry.is_file():
                # print(entry.path)
                with open(entry.path) as f:
                    data = json.loads(f.readline())
                    if data['attention']['A1'] == 8:
                        data_list['text_length'].append(data['params']['textLength'])
                        data_list['interactive'].append(data['params']['interactiveness'])
                        data_list['overall_clarity'].append(data['survey']['S3'])
                        sum_scores = 0
                        for task in range(len(data['task'])):
                            given_answer = data['task']['Q'+str(task+1)]
                            sum_scores += abs(correct_answers[task] - given_answer)
                        data_list['task_score'].append(sum_scores)

df = pandas.DataFrame(data=data_list)


# ANOVA overall_clarity vs text_length and interactive
m = ols("overall_clarity ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova.csv')
print(anova)
print("ANOVA perceived overall task clarity")


# ANOVA Correct answers
m = ols("task_score ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=2)
anova.to_csv('anova.csv')
print(anova)
print("ANOVA task scores")



