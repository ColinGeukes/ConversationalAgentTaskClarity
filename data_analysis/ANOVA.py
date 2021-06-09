import statsmodels.api as sm
from statsmodels.formula.api import ols
import pandas
import os
import json

data_list = {'text_length': [], 'interactive': [], 'score': []}
for interactive in [False, True]:  # True for interactive and False for non-interactive
    for msg_length in [0, 1, 2]:  # 0 for short, 1 for medium and 2 for long

        directory = fr'../f_submissions/f_submissions_L{msg_length}_{interactive}_20p'
        for entry in os.scandir(directory):
            if entry.path.endswith(".json") and entry.is_file():
                # print(entry.path)
                with open(entry.path) as f:
                    data = json.loads(f.readline())
                    data_list['text_length'].append(data['params']['textLength'])
                    data_list['interactive'].append(data['params']['interactiveness'])
                    data_list['score'].append(data['survey']['S1'])

df = pandas.DataFrame(data=data_list)

print(df)

m = ols("score ~ C(text_length)*C(interactive)", data=df).fit()
anova = sm.stats.anova_lm(m, type=5)
anova.to_csv('anova.csv')
print(anova)
